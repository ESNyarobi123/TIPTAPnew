import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  allowBootstrapSuperAdmin:
    process.env.ALLOW_BOOTSTRAP_SUPER_ADMIN === 'true' ||
    process.env.ALLOW_BOOTSTRAP_SUPER_ADMIN === '1',
}));
