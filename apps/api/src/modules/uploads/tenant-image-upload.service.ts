import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIME_TO_EXT = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

export type TenantImageKind = 'menu' | 'beauty-services';

@Injectable()
export class TenantImageUploadService {
  /** Relative to process.cwd() (usually `apps/api` when running the API). */
  private readonly uploadRoot = join(process.cwd(), 'uploads');

  /**
   * Saves image under `uploads/{kind}/{tenantId}/` and returns path to store in `imageUrl`
   * (prefix with API origin + `/api/v1`, e.g. `http://host/api/v1` + path).
   */
  save(kind: TenantImageKind, tenantId: string, file: Express.Multer.File): { path: string } {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    const ext = MIME_TO_EXT.get(file.mimetype);
    if (!ext) {
      throw new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed');
    }
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeTenant !== tenantId) {
      throw new BadRequestException('Invalid tenantId');
    }
    const dir = join(this.uploadRoot, kind, tenantId);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    const diskPath = join(dir, filename);
    writeFileSync(diskPath, file.buffer);

    const path = `/files/${kind}/${tenantId}/${filename}`;
    return { path };
  }
}
