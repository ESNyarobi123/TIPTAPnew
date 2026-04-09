import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  name: process.env.APP_NAME ?? 'tiptap-api',
  sessionDefaultTtlHours: parseInt(process.env.SESSION_DEFAULT_TTL_HOURS ?? '24', 10),
  /** Comma-separated origins for browser clients (e.g. Next.js on :3001). */
  corsOrigins: process.env.CORS_ORIGINS ?? '',
}));
