import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.message,
    });
  }

  if (err.message === 'Game not found') {
    return res.status(404).json({ error: err.message });
  }
  if (err.message === 'Game already finished') {
    return res.status(400).json({ error: err.message });
  }

  logger.error({
    message: err.message,
    path: err.path,
    method: req.method,
  });
  console.log(err);

  res.status(500).json({ error: 'Internal Server Error' });
}
