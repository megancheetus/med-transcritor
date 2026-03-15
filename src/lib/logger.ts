import { NextRequest } from 'next/server';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  ip?: string;
  username?: string;
  error?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log estruturado
   */
  private async writeLog(level: LogLevel, message: string, context?: Record<string, any>, request?: NextRequest) {
    const ip = request ? this.getClientIp(request) : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(ip && { ip }),
    };

    // Console logging para ambos desenvolvimento e produção
    const color = {
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[35m', // Magenta
    }[level];
    const reset = '\x1b[0m';

    console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, context || '');
  }

  info(message: string, context?: Record<string, any>, request?: NextRequest) {
    this.writeLog('info', message, context, request);
  }

  warn(message: string, context?: Record<string, any>, request?: NextRequest) {
    this.writeLog('warn', message, context, request);
  }

  error(message: string, context?: Record<string, any>, request?: NextRequest) {
    this.writeLog('error', message, context, request);
  }

  debug(message: string, context?: Record<string, any>, request?: NextRequest) {
    if (this.isDevelopment) {
      this.writeLog('debug', message, context, request);
    }
  }

  /**
   * Extrair IP do cliente
   */
  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const real = request.headers.get('x-real-ip');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (real) {
      return real;
    }

    return 'unknown';
  }
}

export const logger = new Logger();
