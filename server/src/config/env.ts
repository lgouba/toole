import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),

  // --- OTP / SMS ---
  // 'dev'           -> fixed OTP code (OTP_DEV_CODE), no SMS sent
  // 'africastalking' -> random OTP code, SMS sent via Africa's Talking
  SMS_PROVIDER: z.enum(['dev', 'africastalking']).default('dev'),
  OTP_DEV_CODE: z.string().default('1234'),

  // Africa's Talking
  AT_USERNAME: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  AT_SENDER_ID: z.string().optional(), // e.g. "TOLLE" (optional, uses shortcode if empty)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Validation croisee : si SMS_PROVIDER=africastalking, username + apiKey obligatoires
if (env.SMS_PROVIDER === 'africastalking') {
  if (!env.AT_USERNAME || !env.AT_API_KEY) {
    // eslint-disable-next-line no-console
    console.error(
      'SMS_PROVIDER=africastalking but AT_USERNAME or AT_API_KEY is missing',
    );
    process.exit(1);
  }
}

export type Env = typeof env;
