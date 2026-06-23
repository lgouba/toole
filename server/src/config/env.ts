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
  // 'aqilas'        -> random OTP code, SMS sent via Aqilas (Burkina Faso)
  SMS_PROVIDER: z.enum(['dev', 'africastalking', 'aqilas']).default('dev'),
  OTP_DEV_CODE: z.string().default('1234'),

  // Africa's Talking
  AT_USERNAME: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  AT_SENDER_ID: z.string().optional(), // e.g. "TOLLE" (optional, uses shortcode if empty)

  // Aqilas (provider SMS Burkina Faso — https://www.aqilas.com/app/api)
  AQILAS_API_KEY: z.string().optional(),
  AQILAS_SENDER_ID: z.string().default('TOLLE'), // expediteur visible par le destinataire

  // SMTP (Hostinger, Gmail, etc.) — si non renseigne, les emails ne sont pas envoyes
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(), // ex: "Tolle Admin <noreply@tolle.qalitylabs.fr>"

  // Adresse qui recoit les alertes admin (ex: nouvelle inscription livreur)
  ADMIN_ALERT_EMAIL: z.string().email().optional(),

  // URL publique utilisee pour les liens de suivi destinataire dans les SMS.
  // Ex: "https://admin.tolle.bf" -> les SMS contiendront https://admin.tolle.bf/track/<token>
  // Si vide, les SMS destinataire n'incluent pas de lien de suivi.
  PUBLIC_TRACKING_BASE_URL: z.string().optional(),

  // Sentry DSN pour le crash reporting serveur. Si vide, Sentry est desactive.
  // Format : https://xxx@oXXX.ingest.de.sentry.io/XXX
  SENTRY_DSN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// --- Garde-fous PRODUCTION ---
// Empêche de démarrer la prod avec des secrets d'exemple, et alerte sur une
// config CORS trop permissive. (Hard-exit uniquement sur les valeurs d'exemple
// pour ne pas casser un boot prod légitime.)
if (env.NODE_ENV === 'production') {
  const isExample = (s: string) => /change-?me/i.test(s);
  if (isExample(env.JWT_ACCESS_SECRET) || isExample(env.JWT_REFRESH_SECRET)) {
    // eslint-disable-next-line no-console
    console.error(
      'FATAL: JWT secrets are still the example values ("change-me…") in production. Set strong random secrets (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET).',
    );
    process.exit(1);
  }
  if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32) {
    // eslint-disable-next-line no-console
    console.warn(
      'WARN: JWT secrets shorter than 32 chars in production — use longer random secrets.',
    );
  }
  if (env.CORS_ORIGIN === '*') {
    // eslint-disable-next-line no-console
    console.warn(
      'WARN: CORS_ORIGIN="*" in production reflète n\'importe quelle origine avec credentials. Définir les origines explicites (ex. https://admin-tolle.qalitylabs.fr).',
    );
  }
}

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
if (env.SMS_PROVIDER === 'aqilas') {
  if (!env.AQILAS_API_KEY) {
    // eslint-disable-next-line no-console
    console.error('SMS_PROVIDER=aqilas but AQILAS_API_KEY is missing');
    process.exit(1);
  }
}

export type Env = typeof env;
