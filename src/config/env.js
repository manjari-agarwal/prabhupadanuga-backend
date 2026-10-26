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
  DONATE_NOW_URL: z.string().url().default('https://prabhupadajanmabhumi.org/donate'),
  LOGIN_IMAGE_URL: z.string().url().optional(),
  PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
  PUBLIC_CONTACT_PHONE: z.string().optional(),
  PUBLIC_CONTACT_ADDRESS: z.string().optional(),
  MAX_TRIBUTE_VIDEO_MB: z.coerce.number().int().min(1).max(500).default(200),
  REGISTRATION_ID_PREFIX: z.string().default('PPA'),
  MAX_USER_VIDEOS: z.coerce.number().int().min(0).default(2),
  MAX_USER_STORIES: z.coerce.number().int().min(0).default(2),
  COUNTDOWN_START_AT: z.string().datetime().optional(),
  COUNTDOWN_TARGET_AT: z.string().datetime().optional(),
  CERTIFICATE_ISSUER_NAME: z.string().default('Prabhupadanuga'),
  // Fixed OTP is allowed only for explicitly whitelisted review/test contacts.
  // Every other destination always receives a freshly generated OTP via the live provider.
  MOCK_OTP_CODE: z.string().regex(/^\d{4}$/, 'MOCK_OTP_CODE must be exactly 4 digits').default('1234'),
  MOCK_OTP_ALLOWED_MOBILES: z.string().default(''),
  MOCK_OTP_ALLOWED_EMAILS: z.string().default(''),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(5).default(30),
  OTP_EXPIRES_SECONDS: z.coerce.number().int().min(60).default(600),
  OTP_MAX_REQUESTS_PER_WINDOW: z.coerce.number().int().min(1).default(5),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  EMAIL_PROVIDER: z.enum(['none','smtp']).default('none'),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(), SMTP_PASS: z.string().optional(), SMTP_FROM: z.string().optional(),
  SMS_PROVIDER: z.enum(['none','2factor','twilio']).default('none'),
  TWOFACTOR_API_KEY: z.string().optional(), TWOFACTOR_OTP_TEMPLATE: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(), TWILIO_AUTH_TOKEN: z.string().optional(), TWILIO_FROM: z.string().optional()
});

export const env = schema.parse(process.env);
