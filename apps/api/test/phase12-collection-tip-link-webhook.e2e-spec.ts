import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 12 — COLLECTION webhook sync + tip FK to order/booking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const origFetch = global.fetch;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set (see test/setup-e2e-env.ts)');
    }
    app = await bootstrapApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('/generate-token') || u.includes('/auth/login')) {
        return new Response(JSON.stringify({ success: true, token: 'Bearer mock_tok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('preview-ussd') || u.includes('initiate-ussd')) {
        return new Response(JSON.stringify({ status: 'PENDING' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  afterAll(async () => {
    if (app != null) await app.close();
  });

  const srv = () => request(app.getHttpServer());

  async function seedFoodTenant() {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p12-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p12-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Phase12 Food',
        slug: 'p12-food',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p12-o@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'MAIN' })
      .expect(201);
    return {
      ownerTok: ownerLogin.body.accessToken as string,
      tenantId: tenant.body.id as string,
      branchId: branch.body.id as string,
    };
  }

  async function seedBeautyTenant() {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p12-bs@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p12-bo@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Phase12 Salon',
        slug: 'p12-salon',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p12-bo@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'GLW' })
      .expect(201);
    return {
      ownerTok: ownerLogin.body.accessToken as string,
      tenantId: tenant.body.id as string,
      branchId: branch.body.id as string,
    };
  }

  it('webhook COMPLETED: COLLECTION updates DiningOrder + collectionPaymentId + paidAt', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c',
        apiKey: 'k',
        webhookSecret: 'whsec',
        collectionEnabled: true,
        payoutEnabled: false,
      })
      .expect(200);

    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Lunch', sortOrder: 0 })
      .expect(201);
    const item = await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Soup',
        priceCents: 500,
        currency: 'USD',
        isAvailable: true,
      })
      .expect(201);
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'T12' })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        type: 'TABLE_QR',
        diningTableId: table.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken, language: 'en' })
      .expect(201);
    const tok = start.body.sessionToken as string;
    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });

    const order = await srv()
      .post('/api/v1/food-dining/orders')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        sessionId: sess.id,
        items: [{ menuItemId: item.body.id, quantity: 2 }],
      })
      .expect(201);
    expect(order.body.totalCents).toBe(1000);

    const cfg = await prisma.paymentProviderConfig.findFirstOrThrow({
      where: { tenantId, provider: 'CLICKPESA' },
    });
    const orderRef = `e2e-col-food-${order.body.id.slice(0, 8)}`;
    const txn = await prisma.paymentTransaction.create({
      data: {
        tenantId,
        branchId,
        sessionId: sess.id,
        providerConfigId: cfg.id,
        type: 'COLLECTION',
        amountCents: order.body.totalCents,
        currency: order.body.currency,
        status: 'PENDING',
        orderReference: orderRef,
        phoneNumber: '+255700000000',
        metadata: {
          source: 'conversation',
          diningOrderId: order.body.id,
          vertical: 'FOOD_DINING',
        } as object,
      },
    });

    await srv()
      .post(`/api/v1/payments/webhooks/clickpesa/${tenantId}`)
      .set('x-tiptap-webhook-secret', 'whsec')
      .send({ orderReference: orderRef, status: 'SUCCESS' })
      .expect(201);

    const updated = await prisma.diningOrder.findUniqueOrThrow({ where: { id: order.body.id } });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.collectionPaymentId).toBe(txn.id);
    expect(updated.paidAt).toBeTruthy();
  });

  it('webhook COMPLETED: COLLECTION updates BeautyBooking PAID + collectionPaymentId + paidAt', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c',
        apiKey: 'k',
        webhookSecret: 'whsec',
        collectionEnabled: true,
        payoutEnabled: false,
      })
      .expect(200);

    const cat = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Nails', sortOrder: 0 })
      .expect(201);
    await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Polish',
        priceCents: 800,
        currency: 'USD',
        durationMinutes: 15,
        isAvailable: true,
      })
      .expect(201);
    const station = await srv()
      .post('/api/v1/beauty-grooming/stations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'S12' })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        type: 'STATION_QR',
        beautyStationId: station.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken, language: 'en' })
      .expect(201);
    const tok = start.body.sessionToken as string;
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);

    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    const booking = await prisma.beautyBooking.findFirstOrThrow({
      where: { sessionId: sess.id },
    });
    expect(booking.totalCents).toBe(800);

    const cfg = await prisma.paymentProviderConfig.findFirstOrThrow({
      where: { tenantId, provider: 'CLICKPESA' },
    });
    const orderRef = `e2e-col-beauty-${booking.id.slice(0, 8)}`;
    const txn = await prisma.paymentTransaction.create({
      data: {
        tenantId,
        branchId,
        sessionId: sess.id,
        providerConfigId: cfg.id,
        type: 'COLLECTION',
        amountCents: booking.totalCents,
        currency: booking.currency,
        status: 'PENDING',
        orderReference: orderRef,
        phoneNumber: '+255700000000',
        metadata: {
          source: 'conversation',
          beautyBookingId: booking.id,
          vertical: 'BEAUTY_GROOMING',
        } as object,
      },
    });

    await srv()
      .post(`/api/v1/payments/webhooks/clickpesa/${tenantId}`)
      .set('x-tiptap-webhook-secret', 'whsec')
      .send({ orderReference: orderRef, status: 'SUCCESS' })
      .expect(201);

    const updated = await prisma.beautyBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updated.status).toBe('PAID');
    expect(updated.collectionPaymentId).toBe(txn.id);
    expect(updated.paidAt).toBeTruthy();
  });

  it('webhook COMPLETED: digital tip keeps diningOrderId on Tip row', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c',
        apiKey: 'k',
        webhookSecret: 'whsec',
        collectionEnabled: true,
        payoutEnabled: false,
      })
      .expect(200);

    const staff = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Server' })
      .expect(201);

    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'X', sortOrder: 0 })
      .expect(201);
    const item = await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Bun',
        priceCents: 100,
        currency: 'USD',
        isAvailable: true,
      })
      .expect(201);
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'TT' })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        type: 'TABLE_QR',
        diningTableId: table.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken, language: 'en' })
      .expect(201);
    const tok = start.body.sessionToken as string;
    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });

    const order = await srv()
      .post('/api/v1/food-dining/orders')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        sessionId: sess.id,
        items: [{ menuItemId: item.body.id, quantity: 1 }],
      })
      .expect(201);

    const tip = await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        staffId: staff.body.id,
        sessionId: sess.id,
        diningOrderId: order.body.id,
        mode: 'DIGITAL',
        amountCents: 2000,
        currency: 'TZS',
        phoneNumber: '+255711222333',
        orderReference: 'tip-p12-order-link',
      })
      .expect(201);

    expect(tip.body.diningOrderId).toBe(order.body.id);
    const ord = tip.body.paymentTxn.orderReference as string;

    await srv()
      .post(`/api/v1/payments/webhooks/clickpesa/${tenantId}`)
      .set('x-tiptap-webhook-secret', 'whsec')
      .send({ orderReference: ord, status: 'SUCCESS' })
      .expect(201);

    const tRow = await prisma.tip.findFirstOrThrow({ where: { id: tip.body.id } });
    expect(tRow.status).toBe('COMPLETED');
    expect(tRow.diningOrderId).toBe(order.body.id);
  });

  it('webhook COMPLETED: digital tip keeps beautyBookingId on Tip row', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c',
        apiKey: 'k',
        webhookSecret: 'whsec',
        collectionEnabled: true,
        payoutEnabled: false,
      })
      .expect(200);

    const staff = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Stylist' })
      .expect(201);

    const cat = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Hair', sortOrder: 0 })
      .expect(201);
    await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Cut',
        priceCents: 1200,
        currency: 'USD',
        durationMinutes: 20,
        isAvailable: true,
      })
      .expect(201);
    const station = await srv()
      .post('/api/v1/beauty-grooming/stations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'STY' })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        type: 'STATION_QR',
        beautyStationId: station.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken, language: 'en' })
      .expect(201);
    const tok = start.body.sessionToken as string;
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);

    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    const booking = await prisma.beautyBooking.findFirstOrThrow({
      where: { sessionId: sess.id },
    });

    const tip = await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        staffId: staff.body.id,
        sessionId: sess.id,
        beautyBookingId: booking.id,
        mode: 'DIGITAL',
        amountCents: 3000,
        currency: 'TZS',
        phoneNumber: '+255722333444',
        orderReference: 'tip-p12-beauty-booking-link',
      })
      .expect(201);

    expect(tip.body.beautyBookingId).toBe(booking.id);
    const ord = tip.body.paymentTxn.orderReference as string;

    await srv()
      .post(`/api/v1/payments/webhooks/clickpesa/${tenantId}`)
      .set('x-tiptap-webhook-secret', 'whsec')
      .send({ orderReference: ord, status: 'SUCCESS' })
      .expect(201);

    const tRow = await prisma.tip.findFirstOrThrow({ where: { id: tip.body.id } });
    expect(tRow.status).toBe('COMPLETED');
    expect(tRow.beautyBookingId).toBe(booking.id);
  });
});
