import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './logger';
import { API_CONSTANTS } from './constants';
import {
  getQueuedJobs,
  updateJobStatus,
  updateJobMetadata,
  appendJobLog,
  updateJobProgress,
  addToHistory,
  Job,
} from './db';
import { tagFile } from './tagger';
import { broadcastJobUpdate, broadcastLibraryUpdate } from './websocket';
import { libraryCache } from './libraryCache';

function getIncomingDir() {
  return path.join(config.dataDir, 'incoming');
}

function getProcessingDir() {
  return path.join(config.dataDir, 'processing');
}

export class JobProcessor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentJob: Job | null = null;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  start(): void {
    if (this.isRunning) return;
    
    this.ensureDirectories();
    this.isRunning = true;
    logger.info('Job processor started', 'Processor');
    
    this.processNextJob();
    this.intervalId = setInterval(() => this.processNextJob(), API_CONSTANTS.INTERVALS.JOB_PROCESSOR_CHECK);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.activeProcesses.forEach((proc, jobId) => {
      logger.info(`Killing process for job ${jobId}`, 'Processor');
      proc.kill('SIGTERM');
    });
    this.activeProcesses.clear();
    
    logger.info('Job processor stopped', 'Processor');
  }

  cancelJob(jobId: string): boolean {
    const proc = this.activeProcesses.get(jobId);
    if (proc) {
      logger.info(`Cancelling job ${jobId}`, 'Processor');
      proc.kill('SIGTERM');
      this.activeProcesses.delete(jobId);
      updateJobStatus(jobId, 'FAILED', 'Cancelled by user');
      broadcastJobUpdate(jobId, 'FAILED');
      return true;
    }
    return false;
  }

  private ensureDirectories(): void {
    [getIncomingDir(), getProcessingDir(), config.libraryDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`, 'Processor');
      }
    });
  }

  private async processNextJob(): Promise<void> {
    if (this.currentJob) return;

    const jobs = getQueuedJobs();
    if (jobs.length === 0) return;

    const job = jobs[0];
    this.currentJob = job;

    try {
      await this.processJob(job);
    } catch (error) {
      logger.error(`Job ${job.id} failed`, 'Processor', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateJobStatus(job.id, 'FAILED', errorMessage);
      appendJobLog(job.id, `Error: ${errorMessage}`);
      broadcastJobUpdate(job.id, 'FAILED');
    } finally {
      this.currentJob = null;
      this.activeProcesses.delete(job.id);
    }
  }

  private async processJob(job: Job): Promise<void> {
    logger.job(job.id, `Processing: ${job.url}`);
    appendJobLog(job.id, `Starting download for: ${job.url}`);

    updateJobStatus(job.id, 'DOWNLOADING');
    const downloadResult = await this.downloadAudio(job);
    
    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Download failed');
    }

    appendJobLog(job.id, `Downloaded: ${downloadResult.files.join(', ')}`);
    
    if (downloadResult.title) {
      updateJobMetadata(job.id, downloadResult.title, downloadResult.artist);
    }

    updateJobStatus(job.id, 'TAGGING');
    appendJobLog(job.id, 'Starting metadata tagging...');

    const tagResult = await this.tagWithItunes(
      job,
      downloadResult.files,
      downloadResult.title,
      downloadResult.artist
    );

    if (!tagResult.success) {
      throw new Error(tagResult.error || 'Tagging failed');
    }

    appendJobLog(job.id, 'Tagging completed successfully');
    libraryCache.invalidate();

    updateJobStatus(job.id, 'COMPLETED');
    appendJobLog(job.id, 'Job completed successfully');
    logger.job(job.id, 'Completed');

    addToHistory(job.url, downloadResult.title, downloadResult.artist);
    broadcastJobUpdate(job.id, 'COMPLETED');
    broadcastLibraryUpdate();
  }

  private async downloadAudio(job: Job): Promise<{
    success: boolean;
    files: string[];
    title?: string;
    artist?: string;
    error?: string;
  }> {
    const jobDir = path.join(getIncomingDir(), job.id);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    const formatMap: Record<string, string> = {
      mp3: 'mp3',
      opus: 'opus',
      flac: 'flac',
    };

    const audioFormat = formatMap[job.format] || 'mp3';
    
    const args = [
      '--no-mtime',
      '--no-playlist-reverse',
      '-x',
      '--audio-format', audioFormat,
      '--audio-quality', '0',
      '--embed-thumbnail',
      '--add-metadata',
      '--parse-metadata', '%(artist)s:%(meta_artist)s',
      '--parse-metadata', '%(title)s:%(meta_title)s',
      '-o', path.join(jobDir, '%(title)s.%(ext)s'),
      '--print', 'after_move:filepath',
      '--print', 'title:%(title)s',
      '--print', 'artist:%(artist)s',
      '--newline',
      '--progress',
      '--no-warnings',
      '--ignore-errors',
      job.url,
    ];

    return new Promise((resolve) => {
      const proc = spawn(config.ytDlpPath, args, {
        cwd: jobDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      this.activeProcesses.set(job.id, proc);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            if (line.includes('[download]') && line.includes('%')) {
              const match = line.match(/(\d+\.?\d*)%/);
              if (match) {
                const progress = parseFloat(match[1]);
                updateJobProgress(job.id, Math.round(progress));
                broadcastJobUpdate(job.id, 'DOWNLOADING', Math.round(progress));
              }
            }
            appendJobLog(job.id, `yt-dlp: ${line.trim()}`);
          }
        });
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          if (line.trim() && !line.includes('WARNING')) {
            appendJobLog(job.id, `yt-dlp error: ${line.trim()}`);
          }
        });
      });

      proc.on('close', (code) => {
        this.activeProcesses.delete(job.id);
        
        const files = fs.readdirSync(jobDir)
          .filter(f => ['.mp3', '.opus', '.flac', '.m4a', '.webm'].some(ext => f.endsWith(ext)))
          .map(f => path.join(jobDir, f));

        if (code !== 0 && files.length === 0) {
          resolve({
            success: false,
            files: [],
            error: stderr || `yt-dlp exited with code ${code}`,
          });
          return;
        }

        let title: string | undefined;
        let artist: string | undefined;

        const titleMatch = stdout.match(/title:(.+)/);
        const artistMatch = stdout.match(/artist:(.+)/);
        
        if (titleMatch) title = titleMatch[1].trim();
        if (artistMatch && artistMatch[1].trim() !== 'NA') {
          artist = artistMatch[1].trim();
        }

        resolve({
          success: true,
          files,
          title,
          artist,
        });
      });

      proc.on('error', (error) => {
        this.activeProcesses.delete(job.id);
        resolve({
          success: false,
          files: [],
          error: `Failed to start yt-dlp: ${error.message}`,
        });
      });
    });
  }

  private async tagWithItunes(
    job: Job,
    files: string[],
    title?: string,
    artist?: string
  ): Promise<{ success: boolean; error?: string }> {
    const libraryDir = config.libraryDir;
    
    for (const filePath of files) {
      try {
        const result = await tagFile(
          filePath,
          title || 'Unknown',
          artist,
          (msg) => appendJobLog(job.id, msg),
          job.url
        );

        if (result.success && result.newPath) {
          const finalPath = path.join(libraryDir, path.basename(result.newPath));

          if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
          }

          fs.copyFileSync(result.newPath, finalPath);
          fs.unlinkSync(result.newPath);
          appendJobLog(job.id, `Moved to library: ${path.basename(finalPath)}`);
        } else if (result.error) {
          return { success: false, error: result.error };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMsg };
      }
    }

    const jobDir = path.join(getIncomingDir(), job.id);
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }

    return { success: true };
  }
}

let processorInstance: JobProcessor | null = null;

export function getProcessor(): JobProcessor {
  if (!processorInstance) {
    processorInstance = new JobProcessor();
  }
  return processorInstance;
}
