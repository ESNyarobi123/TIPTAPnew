import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED !== 'false',
  path: process.env.SWAGGER_PATH ?? 'docs',
}));
