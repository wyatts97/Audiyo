import rateLimit from 'express-rate-limit';
import { API_CONSTANTS } from '../constants';

export const apiLimiter = rateLimit({
  windowMs: API_CONSTANTS.RATE_LIMIT.WINDOW_MS,
  max: API_CONSTANTS.RATE_LIMIT.MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const jobCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many job creation requests, please slow down.',
  skipSuccessfulRequests: true,
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many search requests, please slow down.',
});
