import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

/** Rate limits for anonymous QR/session endpoints; disabled when NODE_ENV=test (e2e). */
export function PublicAbuseThrottle(limit = 40, ttlMs = 60_000) {
  if (process.env.NODE_ENV === 'test') {
    return applyDecorators();
  }
  return applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({ default: { limit, ttl: ttlMs } }),
  );
}
