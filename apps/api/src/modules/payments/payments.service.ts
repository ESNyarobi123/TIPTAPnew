import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentTransaction, Prisma } from '@prisma/client';
import {
  BeautyBookingStatus,
  DiningOrderStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { secretsEqualConstantTime } from '../../common/crypto/secret-compare';
import {
  decryptCredentialsJson,
  encryptCredentialsJson,
  maskSecret,
} from '../../common/crypto/payment-credentials-crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { TenantAccessService } from '../tenants/tenant-access.service';
import { ClickPesaApiClient } from './clickpesa/clickpesa-api.client';
import type { ClickPesaCredentials } from './clickpesa/clickpesa.types';
import { PaymentsDispatchService } from './payments-dispatch.service';
import type { CreateCollectionDto } from './dto/create-collection.dto';
import type { CreatePayoutDto } from './dto/create-payout.dto';
import type { UpsertPaymentProviderConfigDto } from './dto/upsert-payment-provider-config.dto';
import type { PaymentRefreshReason } from './payments-queue.constants';

function amountString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function mapProviderStatusToTxn(
  statusRaw: string | null | undefined,
): PaymentTransactionStatus | null {
  if (!statusRaw) {
    return null;
  }
  const u = statusRaw.toUpperCase();
  if (u.includes('SUCCESS') || u === 'COMPLETED' || u === 'PAID') {
    return 'COMPLETED';
  }
  if (u.includes('FAIL') || u === 'FAILED' || u === 'REJECTED') {
    return 'FAILED';
  }
  if (u.includes('PEND') || u === 'PROCESSING' || u === 'INITIATED') {
    return 'PENDING';
  }
  return null;
}

/** Traceable, tenant-scoped default references (caller-supplied refs are still validated for tenant ownership). */
export function defaultOrderReference(tenantId: string, kind: 'col' | 'pay' | 'tipd'): string {
  let slug = tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  if (!slug) {
    slug = 't';
  }
  return `tt_${slug}_${kind}_${randomUUID()}`;
}

function deepFindStatus(obj: unknown, depth = 0): string | null {
  if (depth > 8 || obj == null || typeof obj !== 'object') {
    return null;
  }
  const o = obj as Record<string, unknown>;
  for (const k of ['status', 'paymentStatus', 'transactionStatus', 'state']) {
    const v = o[k];
    if (typeof v === 'string') {
      return v;
    }
  }
  if (typeof o.data === 'object' && o.data) {
    const inner = deepFindStatus(o.data, depth + 1);
    if (inner) {
      return inner;
    }
  }
  return null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly clickpesa: ClickPesaApiClient,
    private readonly dispatch: PaymentsDispatchService,
  ) {}

  private secret() {
    return this.config.get<string>('payments.credentialsSecret');
  }

  async loadClickPesaConfigRow(tenantId: string) {
    const row = await this.prisma.paymentProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'CLICKPESA' } },
    });
    if (!row || !row.isActive) {
      throw new BadRequestException('ClickPesa is not configured for this tenant');
    }
    return row;
  }

  decryptClickPesa(row: { credentialsEncrypted: string }): ClickPesaCredentials {
    return decryptCredentialsJson<ClickPesaCredentials>(this.secret(), row.credentialsEncrypted);
  }

  maskConfigPublic(row: {
    id: string;
    tenantId: string;
    provider: string;
    displayName: string;
    isActive: boolean;
    collectionEnabled: boolean;
    payoutEnabled: boolean;
    settings: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    lastWebhookAt: Date | null;
    credentialsEncrypted: string;
  }) {
    let creds: ClickPesaCredentials | null = null;
    try {
      creds = this.decryptClickPesa(row);
    } catch {
      creds = null;
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      displayName: row.displayName,
      isActive: row.isActive,
      collectionEnabled: row.collectionEnabled,
      payoutEnabled: row.payoutEnabled,
      settings: row.settings,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastWebhookAt: row.lastWebhookAt,
      credentialsPreview: creds
        ? {
            clientId: maskSecret(creds.clientId, 4),
            apiKey: maskSecret(creds.apiKey, 4),
            checksumKeySet: Boolean(creds.checksumKey),
            webhookSecretSet: Boolean(creds.webhookSecret),
          }
        : null,
    };
  }

  private async runUssdInitiateForTxn(
    txn: PaymentTransaction,
    cfg: { id: string },
    creds: ClickPesaCredentials,
    actorUserId?: string,
  ): Promise<PaymentTransaction> {
    if (!txn.phoneNumber?.trim()) {
      throw new BadRequestException('phoneNumber is required for USSD');
    }
    const token = await this.clickpesa.generateToken(creds);
    const bodyBase = {
      amount: amountString(txn.amountCents),
      orderReference: txn.orderReference,
      phoneNumber: txn.phoneNumber.replace(/\s/g, ''),
      currency: txn.currency,
    };
    let checksum: string | undefined;
    if (creds.checksumKey) {
      const payload: Record<string, string> = { ...bodyBase };
      checksum = this.clickpesa.createChecksum(payload, creds.checksumKey);
    }
    const body = checksum ? { ...bodyBase, checksum } : bodyBase;
    try {
      const preview = await this.clickpesa.previewUssdPush(token, body);
      const initiate = await this.clickpesa.initiateUssdPush(token, body);
      const merged = { preview, initiate };
      // Keep status=PENDING until query or webhook maps a terminal state (never COMPLETED from initiate alone).
      const updated = await this.prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          providerConfigId: cfg.id,
          rawRequest: body as unknown as Prisma.InputJsonValue,
          rawResponse: merged as unknown as Prisma.InputJsonValue,
          lastProviderStatus: deepFindStatus(merged) ?? 'INITIATED',
        },
      });
      await this.schedulePendingStatusRefresh(updated, 'ussd-init');
      return updated;
    } catch (e) {
      await this.prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          status: 'FAILED',
          lastProviderStatus: 'ERROR',
          rawResponse: { error: String(e) } as unknown as Prisma.InputJsonValue,
        },
      });
      if (actorUserId) {
        await this.audit.write({
          action: 'UPDATE',
          entityType: 'PaymentTransaction',
          entityId: txn.id,
          tenantId: txn.tenantId,
          actorUserId,
          summary: 'USSD initiation failed',
        });
      }
      throw e;
    }
  }

  async upsertProviderConfig(actor: AuthUser, dto: UpsertPaymentProviderConfigDto) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    const secret = this.secret();
    if (!secret?.trim()) {
      throw new BadRequestException(
        'Payment encryption is not configured. Set environment variable PAYMENTS_CREDENTIALS_SECRET on the API (long random string; see apps/api/.env.example), then restart the server.',
      );
    }
    const enc = encryptCredentialsJson(secret, {
      clientId: dto.clientId,
      apiKey: dto.apiKey,
      ...(dto.checksumKey != null ? { checksumKey: dto.checksumKey } : {}),
      ...(dto.webhookSecret != null ? { webhookSecret: dto.webhookSecret } : {}),
    });
    const row = await this.prisma.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId: dto.tenantId, provider: 'CLICKPESA' } },
      create: {
        tenantId: dto.tenantId,
        provider: 'CLICKPESA',
        displayName: dto.displayName ?? 'ClickPesa',
        credentialsEncrypted: enc,
        isActive: dto.isActive ?? true,
        collectionEnabled: dto.collectionEnabled ?? false,
        payoutEnabled: dto.payoutEnabled ?? false,
      },
      update: {
        ...(dto.displayName != null && dto.displayName !== ''
          ? { displayName: dto.displayName }
          : {}),
        credentialsEncrypted: enc,
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.collectionEnabled != null ? { collectionEnabled: dto.collectionEnabled } : {}),
        ...(dto.payoutEnabled != null ? { payoutEnabled: dto.payoutEnabled } : {}),
      },
    });
    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'PaymentProviderConfig',
      entityId: row.id,
      tenantId: row.tenantId,
      actorUserId: actor.userId,
      summary: 'ClickPesa provider config upserted',
    });
    return this.maskConfigPublic(row);
  }

  async testProviderConfig(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    const cfg = await this.loadClickPesaConfigRow(tenantId);
    const creds = this.decryptClickPesa(cfg);
    const token = await this.clickpesa.generateToken(creds);
    return {
      ok: true,
      provider: 'CLICKPESA',
      note: 'Token generated successfully (credentials valid).',
      tokenPreview: `${token.slice(0, 6)}…${token.slice(-4)}`,
    };
  }

  async listProviderConfigs(actor: AuthUser, tenantId: string) {
    await this.access.assertReadableTenant(actor, tenantId);
    const rows = await this.prisma.paymentProviderConfig.findMany({ where: { tenantId } });
    return rows.map((r) => this.maskConfigPublic(r));
  }

  async getProviderConfig(actor: AuthUser, id: string) {
    const row = await this.prisma.paymentProviderConfig.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Config not found');
    }
    await this.access.assertReadableTenant(actor, row.tenantId);
    return this.maskConfigPublic(row);
  }

  async createCollection(actor: AuthUser, dto: CreateCollectionDto) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    const cfg = await this.loadClickPesaConfigRow(dto.tenantId);
    if (!cfg.collectionEnabled) {
      throw new BadRequestException('Collections are disabled for this tenant');
    }
    const orderRef = dto.orderReference ?? defaultOrderReference(dto.tenantId, 'col');
    const existing = await this.prisma.paymentTransaction.findUnique({
      where: { orderReference: orderRef },
    });
    if (existing) {
      if (existing.tenantId !== dto.tenantId) {
        throw new ForbiddenException('orderReference belongs to another tenant');
      }
      return this.refreshTransactionStatus(actor, existing.id);
    }
    const creds = this.decryptClickPesa(cfg);
    let txn = await this.prisma.paymentTransaction.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId ?? null,
        sessionId: dto.sessionId ?? null,
        providerConfigId: cfg.id,
        type: 'COLLECTION',
        amountCents: dto.amountCents,
        currency: dto.currency.toUpperCase(),
        status: 'PENDING',
        orderReference: orderRef,
        phoneNumber: dto.phoneNumber,
      },
    });
    txn = await this.runUssdInitiateForTxn(txn, cfg, creds, actor.userId);
    await this.audit.write({
      action: 'CREATE',
      entityType: 'PaymentTransaction',
      entityId: txn.id,
      tenantId: txn.tenantId,
      actorUserId: actor.userId,
      summary: 'Collection transaction created',
      details: { orderReference: orderRef } as Prisma.InputJsonValue,
    });
    return txn;
  }

  /**
   * Starts a bill collection via USSD for an authenticated WhatsApp/API session (no staff JWT).
   * Optional `diningOrderId` / `beautyBookingId` are stored on `metadata` for reporting and revalidated here.
   */
  async createCollectionFromConversation(params: {
    sessionId: string;
    tenantId: string;
    branchId: string | null;
    amountCents: number;
    currency: string;
    phoneNumber: string;
    diningOrderId?: string;
    beautyBookingId?: string;
  }): Promise<PaymentTransaction> {
    const sess = await this.prisma.conversationSession.findFirst({
      where: { id: params.sessionId, tenantId: params.tenantId, deletedAt: null },
    });
    if (!sess) {
      throw new BadRequestException('Session not found');
    }
    const branchId = params.branchId ?? sess.branchId ?? null;
    if (sess.branchId && branchId && sess.branchId !== branchId) {
      throw new BadRequestException('Session branch mismatch');
    }
    if (params.diningOrderId && params.beautyBookingId) {
      throw new BadRequestException('Invalid payment link');
    }

    const meta: Record<string, unknown> = {
      source: 'conversation',
      channel: 'WHATSAPP_OR_API',
    };
    if (params.diningOrderId) {
      const ord = await this.prisma.diningOrder.findFirst({
        where: {
          id: params.diningOrderId,
          sessionId: params.sessionId,
          tenantId: params.tenantId,
          deletedAt: null,
          status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
        },
      });
      if (!ord) {
        throw new BadRequestException('Dining order not found for this session');
      }
      if (ord.branchId !== branchId) {
        throw new BadRequestException('Order branch mismatch');
      }
      if (ord.totalCents !== params.amountCents || ord.currency.toUpperCase() !== params.currency.toUpperCase()) {
        throw new BadRequestException('Bill total changed — open Pay again from the menu');
      }
      meta.vertical = 'FOOD_DINING';
      meta.diningOrderId = ord.id;
      meta.orderNumber = ord.orderNumber;
    }
    if (params.beautyBookingId) {
      const booking = await this.prisma.beautyBooking.findFirst({
        where: {
          id: params.beautyBookingId,
          sessionId: params.sessionId,
          tenantId: params.tenantId,
          deletedAt: null,
          status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'] },
        },
      });
      if (!booking) {
        throw new BadRequestException('Booking not found for this session');
      }
      if (booking.branchId !== branchId) {
        throw new BadRequestException('Booking branch mismatch');
      }
      if (
        booking.totalCents !== params.amountCents ||
        booking.currency.toUpperCase() !== params.currency.toUpperCase()
      ) {
        throw new BadRequestException('Visit total changed — open Pay again from the menu');
      }
      meta.vertical = 'BEAUTY_GROOMING';
      meta.beautyBookingId = booking.id;
      meta.bookingNumber = booking.bookingNumber;
    }

    const cfg = await this.loadClickPesaConfigRow(params.tenantId);
    if (!cfg.collectionEnabled) {
      throw new BadRequestException('Collections are disabled for this tenant');
    }
    const orderRef = defaultOrderReference(params.tenantId, 'col');
    const creds = this.decryptClickPesa(cfg);
    let txn = await this.prisma.paymentTransaction.create({
      data: {
        tenantId: params.tenantId,
        branchId,
        sessionId: params.sessionId,
        providerConfigId: cfg.id,
        type: 'COLLECTION',
        amountCents: params.amountCents,
        currency: params.currency.toUpperCase(),
        status: 'PENDING',
        orderReference: orderRef,
        phoneNumber: params.phoneNumber.replace(/\s/g, ''),
        metadata: meta as Prisma.InputJsonValue,
      },
    });
    try {
      txn = await this.runUssdInitiateForTxn(txn, cfg, creds, undefined);
    } catch {
      /* row updated to FAILED in runUssdInitiateForTxn */
    }
    await this.audit.write({
      action: 'CREATE',
      entityType: 'PaymentTransaction',
      entityId: txn.id,
      tenantId: txn.tenantId,
      actorType: 'CONVERSATION_SESSION',
      summary: 'Collection from conversation (USSD)',
      details: {
        orderReference: orderRef,
        sessionId: params.sessionId,
        ...(params.diningOrderId ? { diningOrderId: params.diningOrderId } : {}),
        ...(params.beautyBookingId ? { beautyBookingId: params.beautyBookingId } : {}),
      } as Prisma.InputJsonValue,
    });
    return txn;
  }

  /**
   * Starts USSD for an existing PENDING COLLECTION or TIP_DIGITAL row (used by tips).
   */
  async initiateUssdForTransaction(actor: AuthUser, txnId: string) {
    const txn = await this.prisma.paymentTransaction.findFirst({ where: { id: txnId } });
    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    await this.access.assertWritableTenant(actor, txn.tenantId);
    if (txn.type !== 'COLLECTION' && txn.type !== 'TIP_DIGITAL') {
      throw new BadRequestException('USSD is only supported for collection or digital tip transactions');
    }
    if (txn.status !== 'PENDING') {
      return txn;
    }
    const cfg = await this.loadClickPesaConfigRow(txn.tenantId);
    if (!cfg.collectionEnabled) {
      throw new BadRequestException('Collections are disabled for this tenant');
    }
    const creds = this.decryptClickPesa(cfg);
    return this.runUssdInitiateForTxn(txn, cfg, creds, actor.userId);
  }

  async initiateUssdForTransactionFromSession(sessionId: string, txnId: string): Promise<PaymentTransaction> {
    const txn = await this.prisma.paymentTransaction.findFirst({ where: { id: txnId } });
    if (!txn || txn.sessionId !== sessionId) {
      throw new NotFoundException('Transaction not found for this session');
    }
    if (txn.type !== 'COLLECTION' && txn.type !== 'TIP_DIGITAL') {
      throw new BadRequestException('USSD is only supported for collection or digital tip transactions');
    }
    if (txn.status !== 'PENDING') {
      return txn;
    }
    const cfg = await this.loadClickPesaConfigRow(txn.tenantId);
    if (!cfg.collectionEnabled) {
      throw new BadRequestException('Collections are disabled for this tenant');
    }
    const creds = this.decryptClickPesa(cfg);
    return this.runUssdInitiateForTxn(txn, cfg, creds, undefined);
  }

  async createPayout(actor: AuthUser, dto: CreatePayoutDto) {
    await this.access.assertWritableTenant(actor, dto.tenantId);
    const cfg = await this.loadClickPesaConfigRow(dto.tenantId);
    if (!cfg.payoutEnabled) {
      throw new BadRequestException('Payouts are disabled for this tenant');
    }
    const orderRef = dto.orderReference ?? defaultOrderReference(dto.tenantId, 'pay');
    const existing = await this.prisma.paymentTransaction.findUnique({
      where: { orderReference: orderRef },
    });
    if (existing) {
      if (existing.tenantId !== dto.tenantId) {
        throw new ForbiddenException('orderReference belongs to another tenant');
      }
      return this.refreshTransactionStatus(actor, existing.id);
    }
    const creds = this.decryptClickPesa(cfg);
    const token = await this.clickpesa.generateToken(creds);
    const payoutBody: Record<string, unknown> = {
      amount: amountString(dto.amountCents),
      orderReference: orderRef,
      currency: dto.currency.toUpperCase(),
      ...dto.payoutPayload,
    };
    let txn = await this.prisma.paymentTransaction.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId ?? null,
        sessionId: dto.sessionId ?? null,
        providerConfigId: cfg.id,
        type: 'PAYOUT',
        amountCents: dto.amountCents,
        currency: dto.currency.toUpperCase(),
        status: 'PENDING',
        orderReference: orderRef,
        rawRequest: payoutBody as unknown as Prisma.InputJsonValue,
      },
    });
    try {
      const preview = await this.clickpesa.previewPayout(token, payoutBody);
      const created = await this.clickpesa.createPayout(token, payoutBody);
      const merged = { preview, created };
      // status remains PENDING until query/webhook (do not trust create response as final success).
      txn = await this.prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          rawResponse: merged as unknown as Prisma.InputJsonValue,
          lastProviderStatus: deepFindStatus(merged) ?? 'INITIATED',
        },
      });
      await this.schedulePendingStatusRefresh(txn, 'payout-init');
    } catch (e) {
      txn = await this.prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          status: 'FAILED',
          lastProviderStatus: 'ERROR',
          rawResponse: { error: String(e) } as unknown as Prisma.InputJsonValue,
        },
      });
      throw e;
    }
    await this.audit.write({
      action: 'CREATE',
      entityType: 'PaymentTransaction',
      entityId: txn.id,
      tenantId: txn.tenantId,
      actorUserId: actor.userId,
      summary: 'Payout transaction created',
      details: { orderReference: orderRef } as Prisma.InputJsonValue,
    });
    return txn;
  }

  async listTransactions(actor: AuthUser, tenantId: string, type?: PaymentTransactionType) {
    await this.access.assertReadableTenant(actor, tenantId);
    return this.prisma.paymentTransaction.findMany({
      where: { tenantId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getTransaction(actor: AuthUser, id: string) {
    const row = await this.prisma.paymentTransaction.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Transaction not found');
    }
    await this.access.assertReadableTenant(actor, row.tenantId);
    return row;
  }

  async refreshTransactionStatus(actor: AuthUser, id: string) {
    const row = await this.prisma.paymentTransaction.findFirst({ where: { id } });
    if (!row) {
      throw new NotFoundException('Transaction not found');
    }
    await this.access.assertReadableTenant(actor, row.tenantId);
    const updated = await this.refreshTransactionStatusCore(row);
    await this.schedulePendingStatusRefresh(updated, 'manual-followup');
    return updated;
  }

  async refreshTransactionStatusFromSession(
    sessionId: string,
    txnId: string,
  ): Promise<PaymentTransaction> {
    const row = await this.prisma.paymentTransaction.findFirst({ where: { id: txnId } });
    if (!row || row.sessionId !== sessionId) {
      throw new NotFoundException('Payment not found for this session');
    }
    const updated = await this.refreshTransactionStatusCore(row);
    await this.schedulePendingStatusRefresh(updated, 'manual-followup');
    return updated;
  }

  private async refreshTransactionStatusCore(row: PaymentTransaction): Promise<PaymentTransaction> {
    if (row.status === 'COMPLETED' || row.status === 'FAILED' || row.status === 'REFUNDED') {
      return row;
    }
    const cfg = row.providerConfigId
      ? await this.prisma.paymentProviderConfig.findFirst({ where: { id: row.providerConfigId } })
      : null;
    if (!cfg) {
      return row;
    }
    const creds = this.decryptClickPesa(cfg);
    const token = await this.clickpesa.generateToken(creds);
    const data =
      row.type === 'PAYOUT'
        ? await this.clickpesa.queryPayoutByOrderReference(token, row.orderReference)
        : await this.clickpesa.queryPaymentByOrderReference(token, row.orderReference);
    const st = mapProviderStatusToTxn(deepFindStatus(data) ?? undefined);
    const updated = await this.prisma.paymentTransaction.update({
      where: { id: row.id },
      data: {
        lastProviderStatus: deepFindStatus(data) ?? row.lastProviderStatus ?? undefined,
        rawResponse: data as unknown as Prisma.InputJsonValue,
        ...(st ? { status: st } : {}),
      },
    });
    await this.syncTipStatusFromTxn(updated.id, updated.status);
    await this.syncCollectionLinkedEntities(row.status, updated);
    return updated;
  }

  /**
   * When a conversation COLLECTION reaches COMPLETED, mark linked dining order / beauty booking paid.
   */
  private async syncCollectionLinkedEntities(
    previousTxnStatus: PaymentTransactionStatus,
    txn: PaymentTransaction,
  ) {
    if (txn.type !== 'COLLECTION' || txn.status !== 'COMPLETED') {
      return;
    }
    if (previousTxnStatus === 'COMPLETED') {
      return;
    }
    const meta = txn.metadata;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      return;
    }
    const m = meta as Record<string, unknown>;
    const diningOrderId = typeof m.diningOrderId === 'string' ? m.diningOrderId : null;
    const beautyBookingId = typeof m.beautyBookingId === 'string' ? m.beautyBookingId : null;

    const payableOrderStatuses: DiningOrderStatus[] = [
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'SERVED',
    ];
    const payableBookingStatuses: BeautyBookingStatus[] = [
      'BOOKED',
      'CONFIRMED',
      'CHECKED_IN',
      'IN_SERVICE',
      'COMPLETED',
    ];

    const paidAt = new Date();
    if (diningOrderId) {
      await this.prisma.diningOrder.updateMany({
        where: {
          id: diningOrderId,
          tenantId: txn.tenantId,
          deletedAt: null,
          status: { in: payableOrderStatuses },
        },
        data: {
          status: 'COMPLETED',
          collectionPaymentId: txn.id,
          paidAt,
        },
      });
    }
    if (beautyBookingId) {
      await this.prisma.beautyBooking.updateMany({
        where: {
          id: beautyBookingId,
          tenantId: txn.tenantId,
          deletedAt: null,
          status: { in: payableBookingStatuses },
        },
        data: {
          status: 'PAID',
          collectionPaymentId: txn.id,
          paidAt,
        },
      });
    }
  }

  private async syncTipStatusFromTxn(txnId: string, status: PaymentTransactionStatus) {
    if (status === 'COMPLETED') {
      await this.prisma.tip.updateMany({
        where: { paymentTxnId: txnId },
        data: { status: 'COMPLETED' },
      });
    } else if (status === 'FAILED') {
      await this.prisma.tip.updateMany({
        where: { paymentTxnId: txnId },
        data: { status: 'FAILED' },
      });
    }
  }

  private async schedulePendingStatusRefresh(
    txn: PaymentTransaction,
    reason: PaymentRefreshReason,
  ) {
    if (txn.status !== 'PENDING') {
      return;
    }
    await this.dispatch.safeScheduleRefreshStatus({
      transactionId: txn.id,
      tenantId: txn.tenantId,
      reason,
      attempt: 0,
      maxAttempts: 3,
      requestedAt: new Date().toISOString(),
    });
  }

  private async resolveExternalPaymentUpdateContext(params: {
    tenantId: string;
    orderReference: string;
    headerSecret?: string | null;
  }) {
    const cfgRow = await this.prisma.paymentProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId: params.tenantId, provider: 'CLICKPESA' } },
    });
    if (!cfgRow?.isActive) {
      throw new ForbiddenException('Provider not active');
    }
    const creds = this.decryptClickPesa(cfgRow);
    if (creds.webhookSecret && creds.webhookSecret.length > 0) {
      if (
        !params.headerSecret ||
        !secretsEqualConstantTime(params.headerSecret, creds.webhookSecret)
      ) {
        throw new ForbiddenException('Invalid webhook secret');
      }
    }
    if (!params.orderReference?.trim()) {
      throw new BadRequestException('orderReference is required');
    }
    const row = await this.prisma.paymentTransaction.findUnique({
      where: { orderReference: params.orderReference.trim() },
    });
    if (!row || row.tenantId !== params.tenantId) {
      throw new NotFoundException('Transaction not found for tenant');
    }
    return { cfgRow, row };
  }

  async assertExternalPaymentUpdateAccepted(params: {
    tenantId: string;
    orderReference: string;
    headerSecret?: string | null;
  }) {
    await this.resolveExternalPaymentUpdateContext(params);
  }

  async refreshTransactionStatusByIdInternal(id: string) {
    const row = await this.prisma.paymentTransaction.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Transaction not found');
    }
    return this.refreshTransactionStatusCore(row);
  }

  async applyExternalPaymentUpdate(params: {
    tenantId: string;
    orderReference: string;
    providerStatus: string | null;
    externalRef?: string | null;
    rawPayload?: unknown;
    headerSecret?: string | null;
  }) {
    const { cfgRow, row } = await this.resolveExternalPaymentUpdateContext(params);
    const mapped = mapProviderStatusToTxn(params.providerStatus);
    const previousStatus = row.status;
    const updated = await this.prisma.paymentTransaction.update({
      where: { id: row.id },
      data: {
        lastProviderStatus: params.providerStatus ?? row.lastProviderStatus ?? undefined,
        ...(params.externalRef != null ? { externalRef: params.externalRef } : {}),
        ...(params.rawPayload != null ? { rawResponse: params.rawPayload as Prisma.InputJsonValue } : {}),
        ...(mapped ? { status: mapped } : {}),
      },
    });
    await this.syncTipStatusFromTxn(updated.id, updated.status);
    await this.syncCollectionLinkedEntities(previousStatus, updated);
    await this.prisma.paymentProviderConfig.update({
      where: { id: cfgRow.id },
      data: { lastWebhookAt: new Date() },
    });
    await this.audit.write({
      action: 'UPDATE',
      entityType: 'PaymentTransaction',
      entityId: updated.id,
      tenantId: updated.tenantId,
      actorType: 'WEBHOOK',
      summary: 'Payment transaction updated from webhook/query',
    });
    await this.schedulePendingStatusRefresh(updated, 'webhook-pending');
    return updated;
  }
}
