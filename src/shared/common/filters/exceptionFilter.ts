import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WinstonLogService } from '../../loggers/winston.logger';

/**
 * Global Exception Filter bat moi ngoai le cua he thong,
 * tu dong ghi log loi vao Winston va tra ve JSON chuan dong nhat.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: WinstonLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorRes =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.error || 'UnexpectedError'
        : 'InternalServerError';

    let message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message || exception.message
        : (exception as Error)?.message || 'Internal server error';

    // Xu ly validation error tu Mongoose
    if ((exception as any)?.name === 'ValidationError') {
      errorRes = 'ValidationError';
      message = (exception as any).message;
    }

    // Xu ly duplicate key error tu MongoDB (code 11000)
    if ((exception as any)?.code === 11000) {
      errorRes = 'DuplicateKeyError';
      const field = Object.keys((exception as any).keyValue || {}).join(', ');
      message = `Gia tri truong '${field}' da ton tai trong he thong`;
    }

    this.logger.error(
      `Req ${request.method} ${request.url} - Status: ${status} - Error: ${errorRes}`,
      (exception as Error)?.stack,
      'ExceptionFilter',
    );

    response.status(status).json({
      statusCode: status,
      error: errorRes,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) && message.length === 1 ? message[0] : message,
    });
  }
}
