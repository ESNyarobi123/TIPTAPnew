import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

function sessionHash(sessionToken: string): string {
  return createHash('sha256').update(sessionToken.trim(), 'utf8').digest('hex');
}

describe('Phase 5 — ratings, ClickPesa payments, tips (e2e)', () => {
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
      if (u.includes('query-payment')) {
        return new Response(JSON.stringify({ status: 'SUCCESS' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('preview-payout') || u.includes('create-payout')) {
        return new Response(JSON.stringify({ status: 'PENDING' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('query-payout')) {
        return new Response(JSON.stringify({ status: 'COMPLETED' }), {
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
      .send({ email: 'p5-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Phase5 Food',
        slug: 'p5-food',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p5-o@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'MAIN' })
      .expect(201);
    return {
      superTok: superReg.body.accessToken as string,
      ownerTok: ownerLogin.body.accessToken as string,
      tenantId: tenant.body.id as string,
      branchId: branch.body.id as string,
    };
  }

  it('create business rating via API', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'R1' })
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
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const hash = sessionHash(start.body.sessionToken);
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    const r = await srv()
      .post('/api/v1/ratings')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        sessionId: sess.id,
        targetType: 'BUSINESS',
        targetId: tenantId,
        score: 5,
        comment: 'Great',
      })
      .expect(201);
    expect(r.body.score).toBe(5);
    expect(r.body.targetType).toBe('BUSINESS');
  });

  it('create staff rating from session context (STAFF_QR)', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Waiter Pat' })
      .expect(201);
    await srv()
      .post(`/api/v1/staff/${st.body.id}/assignments`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ branchId })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        type: 'STAFF_QR',
        staffId: st.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const tok = start.body.sessionToken as string;
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '7' })
      .expect(200);
    const pickStaff = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '2' })
      .expect(200);
    expect(pickStaff.body.reply).toMatch(/1.*5|Rate from/i);
    const done = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '5' })
      .expect(200);
    expect(done.body.reply).toMatch(/Thank|Asante|rating/i);
    const hash = sessionHash(tok);
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    const mine = await prisma.rating.findFirst({
      where: { sessionId: sess.id, targetType: 'STAFF' },
    });
    expect(mine?.score).toBe(5);
    expect(mine?.targetId).toBe(st.body.id);
  });

  it('cross-tenant rating target fails', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-s2@tiptap.test', password: PASS })
      .expect(201);
    const o1 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-a@tiptap.test', password: PASS })
      .expect(201);
    const o2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-b@tiptap.test', password: PASS })
      .expect(201);
    const t1 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'T1',
        slug: 'p5-t1',
        ownerUserId: o1.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const t2 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'T2',
        slug: 'p5-t2',
        ownerUserId: o2.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const login1 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p5-a@tiptap.test', password: PASS })
      .expect(200);
    const b1 = await srv()
      .post(`/api/v1/tenants/${t1.body.id}/branches`)
      .set('Authorization', `Bearer ${login1.body.accessToken}`)
      .send({ name: 'B', code: 'B' })
      .expect(201);
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${login1.body.accessToken}`)
      .send({ tenantId: t1.body.id, branchId: b1.body.id, code: 'X' })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${login1.body.accessToken}`)
      .send({
        tenantId: t1.body.id,
        branchId: b1.body.id,
        type: 'TABLE_QR',
        diningTableId: table.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const hash = sessionHash(start.body.sessionToken);
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p5-b@tiptap.test', password: PASS })
      .expect(200);
    await srv()
      .post('/api/v1/ratings')
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .send({
        tenantId: t2.body.id,
        sessionId: sess.id,
        targetType: 'BUSINESS',
        targetId: t2.body.id,
        score: 4,
      })
      .expect(400);
  });

  it('duplicate session rating updates within policy window', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'R2' })
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
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const hash = sessionHash(start.body.sessionToken);
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    await srv()
      .post('/api/v1/ratings')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        sessionId: sess.id,
        targetType: 'BUSINESS',
        targetId: tenantId,
        score: 3,
      })
      .expect(201);
    const second = await srv()
      .post('/api/v1/ratings')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        sessionId: sess.id,
        targetType: 'BUSINESS',
        targetId: tenantId,
        score: 5,
      })
      .expect(201);
    expect(second.body.score).toBe(5);
    const n = await prisma.rating.count({
      where: { sessionId: sess.id, targetType: 'BUSINESS', deletedAt: null },
    });
    expect(n).toBe(1);
  });

  it('conversation business rating flow (table QR)', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'R3' })
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
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const tok = start.body.sessionToken as string;
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '7' })
      .expect(200);
    const t1 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(t1.body.reply).toMatch(/Rate from|Weka alama/i);
    const t2 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '4' })
      .expect(200);
    expect(t2.body.reply).toMatch(/Thank|Asante|rating/i);
  });

  it('list ratings tenant-scoped', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'R4' })
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
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const hash = sessionHash(start.body.sessionToken);
    const sess = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: hash },
    });
    await srv()
      .post('/api/v1/ratings')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        sessionId: sess.id,
        targetType: 'BUSINESS',
        targetId: tenantId,
        score: 5,
      })
      .expect(201);
    const list = await srv()
      .get(`/api/v1/ratings?tenantId=${tenantId}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
  });

  it('ClickPesa config masked; collection + payout rows; idempotent orderReference', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const cfg = await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'cid_test',
        apiKey: 'key_secret_value',
        checksumKey: 'ck',
        collectionEnabled: true,
        payoutEnabled: true,
      })
      .expect(200);
    expect(cfg.body.credentialsPreview.apiKey).toMatch(/\*/);
    expect(cfg.body.credentialsPreview.clientId).toMatch(/\*/);
    const col1 = await srv()
      .post('/api/v1/payments/collections')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        amountCents: 1000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        orderReference: 'idem-1',
      })
      .expect(201);
    expect(col1.body.orderReference).toBe('idem-1');
    const col2 = await srv()
      .post('/api/v1/payments/collections')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        amountCents: 1000,
        currency: 'TZS',
        phoneNumber: '+255700000000',
        orderReference: 'idem-1',
      })
      .expect(201);
    expect(col2.body.id).toBe(col1.body.id);
    const pay = await srv()
      .post('/api/v1/payments/payouts')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        amountCents: 500,
        currency: 'TZS',
        payoutPayload: { msisdn: '+255700000001' },
      })
      .expect(201);
    expect(pay.body.type).toBe('PAYOUT');
  });

  it('webhook and refresh update transaction and digital tip status', async () => {
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
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Tippee' })
      .expect(201);
    const tip = await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        staffId: st.body.id,
        mode: 'DIGITAL',
        amountCents: 2000,
        currency: 'TZS',
        phoneNumber: '+255711222333',
        orderReference: 'tip-order-1',
      })
      .expect(201);
    expect(tip.body.paymentTxn).toBeDefined();
    const ord = tip.body.paymentTxn.orderReference as string;
    await srv()
      .post(`/api/v1/payments/webhooks/clickpesa/${tenantId}`)
      .set('x-tiptap-webhook-secret', 'whsec')
      .send({ orderReference: ord, status: 'SUCCESS' })
      .expect(201);
    const tRow = await prisma.tip.findFirstOrThrow({ where: { id: tip.body.id } });
    expect(tRow.status).toBe('COMPLETED');
  });

  it('cash tip recorded', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Cash staff' })
      .expect(201);
    const tip = await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        staffId: st.body.id,
        mode: 'CASH',
        amountCents: 500,
        currency: 'USD',
      })
      .expect(201);
    expect(tip.body.status).toBe('RECORDED');
    expect(tip.body.mode).toBe('CASH');
  });

  it('digital tip fails when provider missing', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'X' })
      .expect(201);
    await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        staffId: st.body.id,
        mode: 'DIGITAL',
        amountCents: 100,
        currency: 'TZS',
        phoneNumber: '+255700000000',
      })
      .expect(400);
  });

  it('cross-tenant tip fails (wrong staff)', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-s3@tiptap.test', password: PASS })
      .expect(201);
    const o1 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-c@tiptap.test', password: PASS })
      .expect(201);
    const o2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p5-d@tiptap.test', password: PASS })
      .expect(201);
    const t1 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'TC',
        slug: 'p5-tc',
        ownerUserId: o1.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const t2 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'TD',
        slug: 'p5-td',
        ownerUserId: o2.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const login1 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p5-c@tiptap.test', password: PASS })
      .expect(200);
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${login1.body.accessToken}`)
      .send({ tenantId: t1.body.id, displayName: 'Other' })
      .expect(201);
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p5-d@tiptap.test', password: PASS })
      .expect(200);
    const b2 = await srv()
      .post(`/api/v1/tenants/${t2.body.id}/branches`)
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .send({ name: 'B2', code: 'B2' })
      .expect(201);
    await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .send({
        tenantId: t2.body.id,
        branchId: b2.body.id,
        staffId: st.body.id,
        mode: 'CASH',
        amountCents: 100,
        currency: 'USD',
      })
      .expect(400);
  });
});
