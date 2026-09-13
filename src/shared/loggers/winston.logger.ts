import fs from 'fs';
import { Injectable, LoggerService } from '@nestjs/common';
import path from 'path';
import winston, { format } from 'winston';
import 'winston-daily-rotate-file';
import { ENV } from '../configs/env.cnf';

/**
 * Winston Log Service ke thua chuan logger tu menu-bepthu-api
 * Tu dong xoay file hang ngay vao thu muc logs/
 */
@Injectable()
export class WinstonLogService implements LoggerService {
  log(message: any, context?: string) {
    if (typeof message === 'object') this.getLogger(context).info(JSON.stringify(message));
    else this.getLogger(context).info(message);
  }

  error(message: any, trace?: string, context?: string) {
    if (message) {
      if (typeof message === 'object') this.getLogger(context).error(JSON.stringify(message));
      else this.getLogger(context).error(message);
    }
    if (trace) this.getLogger(context).error(trace);
  }

  warn(message: any, context?: string) {
    if (typeof message === 'object') this.getLogger(context).warn(JSON.stringify(message));
    else this.getLogger(context).warn(message);
  }

  debug(message: any, context?: string) {
    if (typeof message === 'object') this.getLogger(context).debug(JSON.stringify(message));
    else this.getLogger(context).debug(message);
  }

  verbose(message: any, context?: string) {
    if (typeof message === 'object') this.getLogger(context).verbose(JSON.stringify(message));
    else this.getLogger(context).verbose(message);
  }

  protected createLogger(_label: string, options: { logLevel?: string; maxFile?: string }) {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) { fs.mkdirSync(logDir, { recursive: true }); }
    const { combine, timestamp, label, printf } = format;

    const logFormat = printf(({ level, message, label, timestamp }) => {
      return `${timestamp} [${label || 'APP'}] [${level.toUpperCase()}]: ${message}`;
    });

    const transports: winston.transport[] = [];

    // File xoay vong hang ngay
    transports.push(
      new (winston.transports as any).DailyRotateFile({
        dirname: logDir,
        filename: '%DATE%-debug.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: options.maxFile || '30d',
        level: options.logLevel ?? 'info',
        handleExceptions: true,
        handleRejections: true,
      }),
    );

    // Hien thi console khi dev
    if (ENV.NODE_ENV === 'development') {
      transports.push(
        new winston.transports.Console({
          level: 'debug',
          format: combine(format.colorize(), timestamp(), logFormat),
        }),
      );
    }

    winston.loggers.add(_label, {
      levels: winston.config.npm.levels,
      format: combine(label({ label: _label }), timestamp(), logFormat),
      transports,
      exitOnError: false,
    });

    return winston.loggers.get(_label);
  }

  protected getLogger(label = 'iMenu'): winston.Logger {
    if (winston.loggers.has(label)) {
      return winston.loggers.get(label);
    }
    return this.createLogger(label, { maxFile: '30d' });
  }
}
