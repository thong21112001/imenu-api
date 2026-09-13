import { Injectable, NestMiddleware } from '@nestjs/common';
import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware Morgan ghi nhan HTTP request incoming voi status code va latency
 */
@Injectable()
export class MorganLogService implements NestMiddleware {
  private morganMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms');

  use(req: Request, res: Response, next: NextFunction) {
    this.morganMiddleware(req, res, next);
  }

  middleware() {
    return this.morganMiddleware;
  }
}
