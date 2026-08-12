import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config';

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    error: {
      message: 'Too many requests from this client. Please slow down and try again shortly.',
    },
    timestamp: new Date().toISOString(),
  },
});
