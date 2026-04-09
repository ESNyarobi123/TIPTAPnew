import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    let payload: Record<string, unknown> = { message: 'Internal server error' };
    if (typeof raw === 'string') {
      payload = { message: raw };
    } else if (typeof raw === 'object' && raw !== null) {
      payload = { ...(raw as Record<string, unknown>) };
    }

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      ...payload,
    });
  }
}
