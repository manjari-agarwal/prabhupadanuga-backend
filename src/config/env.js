import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(7000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  APP_ORIGIN: z.string().default('*'),
  REGISTRATION_ID_PREFIX: z.string().default('PPA'),
  MAX_USER_VIDEOS: z.coerce.number().int().min(0).default(2),
  MAX_USER_STORIES: z.coerce.number().int().min(0).default(2)
});

export const env = schema.parse(process.env);
