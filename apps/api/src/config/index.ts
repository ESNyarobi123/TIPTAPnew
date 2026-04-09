import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import adminConfig from './admin.config';
import paymentsConfig, { clickpesaConfig } from './payments.config';
import redisConfig from './redis.config';
import swaggerConfig from './swagger.config';

export const configLoaders = [
  appConfig,
  authConfig,
  databaseConfig,
  redisConfig,
  swaggerConfig,
  adminConfig,
  paymentsConfig,
  clickpesaConfig,
];
