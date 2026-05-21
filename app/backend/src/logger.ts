import { config } from './config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  data?: any;
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = config.nodeEnv === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }

  private formatLog(level: string, message: string, context?: string, data?: any): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
    };

    if (config.nodeEnv === 'production') {
      return JSON.stringify(entry);
    }

    const emoji = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔍',
    }[level] || '📝';

    let output = `${emoji} [${entry.timestamp}] ${level}`;
    if (context) output += ` [${context}]`;
    output += `: ${message}`;
    if (data) output += `\n${JSON.stringify(data, null, 2)}`;

    return output;
  }

  error(message: string, context?: string, data?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatLog('ERROR', message, context, data));
    }
  }

  warn(message: string, context?: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatLog('WARN', message, context, data));
    }
  }

  info(message: string, context?: string, data?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(this.formatLog('INFO', message, context, data));
    }
  }

  debug(message: string, context?: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(this.formatLog('DEBUG', message, context, data));
    }
  }

  job(jobId: string, message: string, data?: any): void {
    this.info(message, `Job:${jobId}`, data);
  }

  api(method: string, path: string, status: number, duration?: number): void {
    const message = `${method} ${path} - ${status}${duration ? ` (${duration}ms)` : ''}`;
    if (status >= 500) {
      this.error(message, 'API');
    } else if (status >= 400) {
      this.warn(message, 'API');
    } else {
      this.debug(message, 'API');
    }
  }
}

export const logger = new Logger();
