/**
 * Elysian Trading System - Error Handler
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export interface ElysianError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  error: ElysianError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? (statusCode === 500 ? 'Internal Server Error' : error.message)
    : error.message;

  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.url
  });
}

export function createError(message: string, statusCode: number = 500, code?: string): ElysianError {
  const error = new Error(message) as ElysianError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
