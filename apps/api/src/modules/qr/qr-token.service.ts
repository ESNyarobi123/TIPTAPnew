import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QrTokenService {
  sha256Hex(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /** Opaque bearer secret shown once on create/rotate. */
  generateRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Short handle for URLs; useless without the secret. */
  generatePublicRef(): string {
    return randomBytes(6).toString('hex');
  }
}
