import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison for secrets of unknown length (avoids length leaks vs raw timingSafeEqual on UTF-8 buffers).
 */
export function secretsEqualConstantTime(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}
