import { registerAs } from '@nestjs/config';

export default registerAs('admin', () => ({
  commissionRate: Number(process.env.ADMIN_COMMISSION_RATE ?? 0.05),
}));

