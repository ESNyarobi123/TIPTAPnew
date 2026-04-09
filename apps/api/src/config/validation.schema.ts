import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().default(
    'postgresql://postgres:postgres@localhost:5432/tiptap',
  ),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  JWT_ACCESS_SECRET: Joi.string()
    .min(16)
    .default('dev_access_secret_change_in_prod_1'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(16)
    .default('dev_refresh_secret_change_in_prod_1'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  ALLOW_BOOTSTRAP_SUPER_ADMIN: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SESSION_DEFAULT_TTL_HOURS: Joi.number().default(24),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  SWAGGER_PATH: Joi.string().default('docs'),
  PAYMENTS_CREDENTIALS_SECRET: Joi.string().allow('').optional().default(''),
  /** Dashboard / reconciliation: PENDING older than this is flagged stale (hours). */
  PAYMENTS_STALE_PENDING_HOURS: Joi.number().min(1).max(8760).default(48),
  /** Dashboard heuristic: webhook idle threshold while PENDING txns exist (hours). */
  PAYMENTS_WEBHOOK_STALE_HOURS: Joi.number().min(1).max(8760).default(72),
  /** Admin analytics: platform commission rate (0..1) used for dashboard estimates. */
  ADMIN_COMMISSION_RATE: Joi.number().min(0).max(1).default(0.05),
  CLICKPESA_API_BASE_URL: Joi.string().optional().allow(''),
  /** Shared key for worker/internal job callbacks into the API. */
  INTERNAL_SERVICES_KEY: Joi.string().optional().allow('').default('tiptap_internal_dev_key'),
  /** Bot gateway base URL for admin tools (server-to-server). */
  BOT_GATEWAY_BASE_URL: Joi.string().optional().allow('').default('http://localhost:3002'),
  /** Shared key required by bot-gateway admin endpoints (never expose to browser). */
  BOT_GATEWAY_ADMIN_KEY: Joi.string().optional().allow('').default(''),
});
