import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    logger.warn('Validation error', 'ErrorHandler', { errors: err.issues });
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof AppError) {
    logger.error(err.message, 'ErrorHandler', { statusCode: err.statusCode });
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  logger.error('Unhandled error', 'ErrorHandler', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    message: 'Internal server error',
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
