import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  dataDir: string;
  libraryDir: string;
  ytDlpPath: string;
}

function validateEnv(): Config {
  const errors: string[] = [];

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
  const libraryDir = process.env.LIBRARY_DIR || path.join(dataDir, 'library');
  const ytDlpPath = process.env.YT_DLP_PATH || 'yt-dlp';

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   PORT: ${port}`);
  console.log(`   DATA_DIR: ${dataDir}`);
  console.log(`   YT_DLP_PATH: ${ytDlpPath}`);

  return {
    port,
    nodeEnv,
    frontendUrl,
    dataDir,
    libraryDir,
    ytDlpPath,
  };
}

export const config = validateEnv();
