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
  MAX_USER_STORIES: z.coerce.number().int().min(0).default(2),
  COUNTDOWN_START_AT: z.string().datetime().optional(),
  COUNTDOWN_TARGET_AT: z.string().datetime().optional(),
  CERTIFICATE_ISSUER_NAME: z.string().default('Prabhupadanuga'),
  // DEV and test always use MOCK_OTP_CODE. In production, only the contacts
  // configured below use the mock code; every other contact uses the provider.
  MOCK_OTP_CODE: z.string().regex(/^\d{4}$/, 'MOCK_OTP_CODE must be exactly 4 digits').default('1234'),
  PRODUCTION_MOCK_OTP_ALLOWED_MOBILES: z.string().default(''),
  PRODUCTION_MOCK_OTP_ALLOWED_EMAILS: z.string().default(''),
  OTP_API_URL: z.string().optional(),
  OTP_API_KEY: z.string().optional()
});

export const env = schema.parse(process.env);
