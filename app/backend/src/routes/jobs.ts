import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createJob,
  getAllJobs,
  getJob,
  deleteJob,
  resetJob,
  isInHistory,
} from '../db';
import { logger } from '../logger';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { jobCreationLimiter } from '../middleware/rateLimiter';
import { jobCreateSchema } from '../validation';
import { getProcessor } from '../processor';

export const jobRouter = Router();

jobRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const jobs = getAllJobs();
  res.json({ jobs });
}));

jobRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  res.json({ job });
}));

jobRouter.post('/', jobCreationLimiter, asyncHandler(async (req: Request, res: Response) => {
  const validated = jobCreateSchema.parse(req.body);

  if (!validated.force && isInHistory(validated.url)) {
    return res.status(409).json({ 
      message: 'This URL has already been downloaded',
      duplicate: true 
    });
  }

  const id = uuidv4();
  const job = createJob(id, validated.url, validated.format);

  logger.info(`Job created: ${id}`, 'Jobs', { url: validated.url, format: validated.format });
  res.status(201).json({ job });
}));

jobRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = deleteJob(req.params.id);
  if (!deleted) {
    throw new AppError(404, 'Job not found');
  }
  logger.info(`Job deleted: ${req.params.id}`, 'Jobs');
  res.json({ message: 'Job deleted' });
}));

jobRouter.post('/:id/retry', asyncHandler(async (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  if (job.status !== 'FAILED') {
    throw new AppError(400, 'Only failed jobs can be retried');
  }

  const reset = resetJob(req.params.id);
  if (!reset) {
    throw new AppError(500, 'Failed to reset job');
  }

  logger.info(`Job retry: ${req.params.id}`, 'Jobs');
  const updatedJob = getJob(req.params.id);
  res.json({ job: updatedJob });
}));

jobRouter.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  if (job.status === 'COMPLETED' || job.status === 'FAILED') {
    throw new AppError(400, 'Job is already finished');
  }

  const processor = getProcessor();
  const cancelled = processor.cancelJob(req.params.id);

  if (!cancelled) {
    throw new AppError(400, 'Job is not currently running');
  }

  logger.info(`Job cancelled: ${req.params.id}`, 'Jobs');
  const updatedJob = getJob(req.params.id);
  res.json({ job: updatedJob });
}));

