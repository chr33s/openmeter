// Structured logging utility

import type { LogContext } from '@/types';

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId?: string;
  context?: Record<string, any>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private context: Partial<LogContext>;

  constructor(context: Partial<LogContext> = {}) {
    this.context = context;
  }

  // Create child logger with additional context
  child(additionalContext: Record<string, any>): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext
    });
  }

  // Log debug message
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  // Log info message
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  // Log warning message
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  // Log error message
  error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : {};

    this.log('error', message, { ...context, ...errorContext });
  }

  // Log request start
  requestStart(method: string, url: string, headers?: Record<string, string>): Logger {
    const requestId = crypto.randomUUID();
    const requestLogger = this.child({ 
      requestId,
      method,
      url,
      startTime: Date.now()
    });

    requestLogger.info('Request started', {
      userAgent: headers?.['user-agent'],
      cfRay: headers?.['cf-ray'],
      cfCountry: headers?.['cf-ipcountry']
    });

    return requestLogger;
  }

  // Log request end
  requestEnd(status: number, responseSize?: number): void {
    const duration = this.context.startTime ? Date.now() - this.context.startTime : undefined;
    
    this.info('Request completed', {
      status,
      duration,
      responseSize
    });
  }

  // Log database operation
  dbOperation(operation: string, table: string, duration?: number, context?: Record<string, any>): void {
    this.info(`Database ${operation}`, {
      table,
      duration,
      ...context
    });
  }

  // Log cache operation
  cacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, context?: Record<string, any>): void {
    this.debug(`Cache ${operation}`, {
      key,
      ...context
    });
  }

  // Log authentication event
  authEvent(event: 'success' | 'failure', method: 'api-key' | 'jwt', context?: Record<string, any>): void {
    this.info(`Authentication ${event}`, {
      method,
      ...context
    });
  }

  // Log rate limit event
  rateLimitEvent(allowed: boolean, remaining: number, resetTime: number, context?: Record<string, any>): void {
    this.info('Rate limit check', {
      allowed,
      remaining,
      resetTime,
      ...context
    });
  }

  // Core logging method
  private log(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context.requestId,
      context: {
        ...this.context,
        ...context
      }
    };

    // Calculate duration if start time is available
    if (this.context.startTime) {
      logEntry.duration = Date.now() - this.context.startTime;
    }

    // Output to console (Cloudflare Workers logs)
    const logString = JSON.stringify(logEntry);
    
    switch (level) {
      case 'debug':
        console.debug(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }
}

// Create logger instance
export function createLogger(context?: Partial<LogContext>): Logger {
  return new Logger(context);
}

// Request logging middleware helper
export function withRequestLogging(request: Request): Logger {
  const headers = Object.fromEntries(request.headers.entries());
  return createLogger().requestStart(
    request.method,
    request.url,
    headers
  );
}