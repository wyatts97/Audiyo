import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './logger';
import { initDatabase, cleanupOldJobs } from './db';
import { jobRouter } from './routes/jobs';
import { libraryRouter } from './routes/library';
import { settingsRouter } from './routes/settings';
import { getProcessor } from './processor';
import { initWebSocket } from './websocket';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { libraryCache } from './libraryCache';
import { API_CONSTANTS } from './constants';
import { getSetting } from './db';

const app = express();
const server = createServer(app);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use('/api', apiLimiter);

initDatabase();
initWebSocket(server);

const libraryPath = getSetting('libraryPath', config.libraryDir);
libraryCache.initialize(libraryPath);
logger.info('Library cache initialized', 'Startup');

app.use('/api/jobs', jobRouter);
app.use('/api/library', libraryRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', async (req, res) => {
  const { spawn } = require('child_process');
  const fs = require('fs');
  
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'ok',
    ytDlp: 'unknown',
    diskSpace: 'unknown',
    cache: libraryCache.getStats(),
  };

  try {
    const ytDlpCheck = spawn(config.ytDlpPath, ['--version']);
    ytDlpCheck.on('close', (code: number) => {
      checks.ytDlp = code === 0 ? 'ok' : 'error';
    });
  } catch (e) {
    checks.ytDlp = 'error';
  }

  try {
    const stats = fs.statfsSync ? fs.statfsSync(config.dataDir) : null;
    if (stats) {
      const freeGB = (stats.bavail * stats.bsize) / (1024 ** 3);
      checks.diskSpace = `${freeGB.toFixed(2)} GB free`;
    }
  } catch (e) {
    checks.diskSpace = 'error';
  }

  res.json(checks);
});

const processor = getProcessor();
processor.start();

setInterval(() => {
  const deleted = cleanupOldJobs(API_CONSTANTS.CLEANUP.OLD_JOBS_DAYS);
  if (deleted > 0) {
    logger.info(`Cleaned up ${deleted} old failed jobs`, 'Cleanup');
  }
}, API_CONSTANTS.INTERVALS.OLD_JOBS_CLEANUP);

app.use(errorHandler);

server.listen(config.port, () => {
  logger.info(`audiyo backend running on port ${config.port}`, 'Startup');
});

process.on('SIGINT', () => {
  logger.info('Shutting down...', 'Shutdown');
  processor.stop();
  libraryCache.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...', 'Shutdown');
  processor.stop();
  libraryCache.cleanup();
  process.exit(0);
});
