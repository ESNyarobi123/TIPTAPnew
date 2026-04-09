import type { QrType } from '@prisma/client';

/** Safe context returned after validating an opaque QR secret. */
export type QrValidatedContext = {
  qrCodeId: string;
  publicRef: string;
  tenantId: string;
  branchId: string | null;
  type: QrType;
  staffId: string | null;
  diningTableId: string | null;
  beautyStationId: string | null;
  metadata: unknown;
};
