import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 6 — analytics, dashboards, audit reads, statements, reconciliation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const origFetch = global.fetch;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set');
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
      .send({ email: 'p6-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p6-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Phase6 Food',
        slug: 'p6-food',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p6-o@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'MAIN' })
      .expect(201);
    const branch2 = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Second', code: 'SEC' })
      .expect(201);
    return {
      superTok: superReg.body.accessToken as string,
      ownerTok: ownerLogin.body.accessToken as string,
      tenantId: tenant.body.id as string,
      branchId: branch.body.id as string,
      branch2Id: branch2.body.id as string,
      ownerUserId: owner.body.user.id as string,
    };
  }

  it('tenant-safe analytics overview', async () => {
    const { ownerTok, tenantId } = await seedFoodTenant();
    const res = await srv()
      .get('/api/v1/analytics/overview')
      .query({ tenantId })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(res.body.scope.tenantIds).toEqual([tenantId]);
    expect(res.body.payments).toBeDefined();
    expect(res.body.ratings).toBeDefined();
    const paySeries = await srv()
      .get('/api/v1/analytics/payments')
      .query({ tenantId, groupBy: 'day' })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(Array.isArray(paySeries.body.volumeOverTime)).toBe(true);
  });

  it('cross-tenant analytics access fails', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p6-s2@tiptap.test', password: PASS })
      .expect(201);
    const o1 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p6-a@tiptap.test', password: PASS })
      .expect(201);
    const o2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p6-b@tiptap.test', password: PASS })
      .expect(201);
    const t1 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'TA',
        slug: 'p6-ta',
        ownerUserId: o1.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'TB',
        slug: 'p6-tb',
        ownerUserId: o2.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p6-b@tiptap.test', password: PASS })
      .expect(200);
    await srv()
      .get('/api/v1/analytics/overview')
      .query({ tenantId: t1.body.id })
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .expect(403);
  });

  it('branch-scoped analytics filters (BRANCH_MANAGER)', async () => {
    const { tenantId, branchId, branch2Id, ownerTok, ownerUserId } = await seedFoodTenant();
    const bmReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p6-bm@tiptap.test', password: PASS })
      .expect(201);
    await prisma.userRoleAssignment.create({
      data: {
        userId: bmReg.body.user.id,
        role: 'BRANCH_MANAGER',
        tenantId,
        branchId,
      },
    });
    const staffMain = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, displayName: 'S1' })
      .expect(201);
    const staffSec = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId: branch2Id, displayName: 'S2' })
      .expect(201);
    await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        staffId: staffMain.body.id,
        mode: 'CASH',
        amountCents: 500,
        currency: 'USD',
      })
      .expect(201);
    await srv()
      .post('/api/v1/tips')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId: branch2Id,
        staffId: staffSec.body.id,
        mode: 'CASH',
        amountCents: 900,
        currency: 'USD',
      })
      .expect(201);
    const bmLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p6-bm@tiptap.test', password: PASS })
      .expect(200);
    const scoped = await srv()
      .get('/api/v1/analytics/tips')
      .query({ tenantId })
      .set('Authorization', `Bearer ${bmLogin.body.accessToken}`)
      .expect(200);
    const cashTotal = scoped.body.totals.cashTipsCents;
    expect(cashTotal).toBe(500);
    expect(ownerUserId).toBeDefined();
  });

  it('payments dashboard config health and recent transactions', async () => {
    const { ownerTok, tenantId } = await seedFoodTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c',
        apiKey: 'k',
        webhookSecret: 'whsec',
        collectionEnabled: true,
        payoutEnabled: true,
      })
      .expect(200);
    const health = await srv()
      .get('/api/v1/payments/dashboard/config-health')
      .query({ tenantId })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(health.body.providers.length).toBeGreaterThanOrEqual(1);
    expect(health.body.providers[0].webhookConfigured).toBe(true);
    const recent = await srv()
      .get('/api/v1/payments/dashboard/recent-transactions')
      .query({ tenantId, pageSize: 10 })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(recent.body.items).toBeDefined();
    expect(Array.isArray(recent.body.items)).toBe(true);
  });

  it('audit log reads with tenant filter', async () => {
    const { ownerTok, tenantId } = await seedFoodTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c2',
        apiKey: 'k2',
        collectionEnabled: true,
      })
      .expect(200);
    const logs = await srv()
      .get('/api/v1/audit-logs')
      .query({ tenantId, pageSize: 20 })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(logs.body.total).toBeGreaterThanOrEqual(1);
    const one = await srv()
      .get(`/api/v1/audit-logs/${logs.body.items[0].id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(one.body.id).toBe(logs.body.items[0].id);
  });

  it('statement generation and retrieval by key', async () => {
    const { ownerTok, tenantId } = await seedFoodTenant();
    const start = '2025-01-01T00:00:00.000Z';
    const end = '2026-12-31T23:59:59.999Z';
    const q = { tenantId, startDate: start, endDate: end };
    const st = await srv()
      .get('/api/v1/statements')
      .query(q)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(st.body.statementKey).toBeDefined();
    expect(st.body.totals).toBeDefined();
    const again = await srv()
      .get(`/api/v1/statements/by-key/${encodeURIComponent(st.body.statementKey)}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(again.body.statementKey).toBe(st.body.statementKey);
    const posted = await srv()
      .post('/api/v1/statements/generate')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send(q)
      .expect(201);
    expect(posted.body.totals).toBeDefined();
  });

  it('reconciliation overview and stale pending detection', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c3',
        apiKey: 'k3',
        collectionEnabled: true,
      })
      .expect(200);
    const col = await srv()
      .post('/api/v1/payments/collections')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        amountCents: 1000,
        currency: 'TZS',
        phoneNumber: '+255700000001',
      })
      .expect(201);
    await prisma.paymentTransaction.update({
      where: { id: col.body.id },
      data: { updatedAt: new Date('2020-01-01T00:00:00.000Z'), status: 'PENDING' },
    });
    const ov = await srv()
      .get('/api/v1/reconciliation/overview')
      .query({ tenantId })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(ov.body.counts.stalePending).toBeGreaterThanOrEqual(1);
    const ex = await srv()
      .get('/api/v1/reconciliation/exceptions')
      .query({ tenantId })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(ex.body.stalePending.length).toBeGreaterThanOrEqual(1);
  });

  it('reconciliation transactions mismatchOnly', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    await srv()
      .post('/api/v1/payments/provider-config')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        clientId: 'c4',
        apiKey: 'k4',
        collectionEnabled: true,
      })
      .expect(200);
    const col = await srv()
      .post('/api/v1/payments/collections')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        amountCents: 2000,
        currency: 'TZS',
        phoneNumber: '+255700000002',
      })
      .expect(201);
    await prisma.paymentTransaction.update({
      where: { id: col.body.id },
      data: { status: 'PENDING', lastProviderStatus: 'SUCCESS' },
    });
    const res = await srv()
      .get('/api/v1/reconciliation/transactions')
      .query({ tenantId, mismatchOnly: true })
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((x: { mismatch: boolean }) => x.mismatch)).toBe(true);
  });
});
