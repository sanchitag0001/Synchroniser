import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';
import { logger } from '../logger/pino.logger';
import { env } from '../config/env.config';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  logger.error(
    {
      err: {
        name: err.name,
        message: err.message,
        stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        details: isAppError ? err.details : undefined,
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      },
    },
    `🚨 [${req.method}] ${req.originalUrl} - ${message}`
  );

  res.status(statusCode).json({
    success: false,
    statusCode,
    error: {
      message,
      ...(isAppError && err.details ? { details: err.details } : {}),
      ...(env.NODE_ENV === 'development' && !isAppError ? { stack: err.stack } : {}),
    },
    timestamp: new Date().toISOString(),
  });
};
