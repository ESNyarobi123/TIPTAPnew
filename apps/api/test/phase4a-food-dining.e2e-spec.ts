import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 4A — FOOD_DINING data + conversation wiring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set (see test/setup-e2e-env.ts)');
    }
    app = await bootstrapApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    if (app != null) await app.close();
  });

  const srv = () => request(app.getHttpServer());

  async function seedFoodTenant() {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4a-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4a-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Bistro Phase4',
        slug: 'bistro-p4a',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p4a-o@tiptap.test', password: PASS })
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

  it('create menu category and item; list tenant-safely', async () => {
    const { ownerTok, tenantId } = await seedFoodTenant();
    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Mains', sortOrder: 1 })
      .expect(201);
    expect(cat.body.name).toBe('Mains');
    const item = await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Grilled fish',
        description: 'Fresh',
        priceCents: 1850,
        currency: 'USD',
        isAvailable: true,
        displayOrder: 1,
      })
      .expect(201);
    expect(item.body.priceCents).toBe(1850);
    const list = await srv()
      .get(`/api/v1/food-dining/menu-categories`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === cat.body.id)).toBe(true);
    const items = await srv()
      .get(`/api/v1/food-dining/menu-items?categoryId=${cat.body.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(items.body).toHaveLength(1);
    expect(items.body[0].name).toBe('Grilled fish');
  });

  it('create dining table and TABLE_QR', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        code: 'T7',
        label: 'Window',
        capacity: 4,
      })
      .expect(201);
    expect(table.body.code).toBe('T7');
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
    expect(qr.body.rawToken).toBeDefined();
  });

  it('conversation: view real categories and items; waiter + bill persistence', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Starters', sortOrder: 0 })
      .expect(201);
    await srv()
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
    await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Salad',
        priceCents: 650,
        currency: 'USD',
        isAvailable: false,
      })
      .expect(201);
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'T1' })
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

    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    const m2 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(m2.body.reply).toMatch(/Starters/);
    expect(m2.body.session.currentState).toBe('FOOD_MENU_CATEGORIES');

    const m3 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(m3.body.reply).toMatch(/Soup/);
    expect(m3.body.reply).toMatch(/5\.00/);
    expect(m3.body.reply).toMatch(/unavailable/i);
    expect(m3.body.session.currentState).toBe('FOOD_MENU_ITEMS');

    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '0' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '0' })
      .expect(200);

    const billMsg = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '2' })
      .expect(200);
    expect(billMsg.body.reply).toMatch(/bill/i);

    const waiterMsg = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '3' })
      .expect(200);
    expect(waiterMsg.body.reply).toMatch(/waiter|mhudumu/i);

    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirst({
      where: { clientTokenHash: hash },
    });
    expect(sess).toBeTruthy();
    const bills = await prisma.billRequest.findMany({ where: { sessionId: sess!.id } });
    const calls = await prisma.waiterCallRequest.findMany({ where: { sessionId: sess!.id } });
    expect(bills.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(bills[0].tableId).toBe(table.body.id);
    expect(calls[0].tableId).toBe(table.body.id);
  });

  it('language switch + real menu labels (Swahili titles)', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Drinks' })
      .expect(201);
    await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Water',
        priceCents: 0,
      })
      .expect(201);
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'T2' })
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
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '5' })
      .expect(200);
    const sw = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '2' })
      .expect(200);
    expect(sw.body.session.language).toBe('sw');
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    const menu = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(menu.body.reply).toMatch(/Makundi|menyu/i);
    expect(menu.body.reply).toMatch(/Drinks/);
  });

  it('cross-tenant cannot read another tenant food-dining resources', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4a-s2@tiptap.test', password: PASS })
      .expect(201);
    const o1 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4a-a@tiptap.test', password: PASS })
      .expect(201);
    const o2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4a-b@tiptap.test', password: PASS })
      .expect(201);
    const t1 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'TA',
        slug: 'p4a-ta',
        ownerUserId: o1.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'TB',
        slug: 'p4a-tb',
        ownerUserId: o2.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p4a-b@tiptap.test', password: PASS })
      .expect(200);
    await srv()
      .get(`/api/v1/food-dining/menu-categories?tenantId=${t1.body.id}`)
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .expect(403);
  });

  it('waiter call and bill request status updates', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'T9' })
      .expect(201);
    const w = await srv()
      .post('/api/v1/food-dining/waiter-calls')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        tableId: table.body.id,
      })
      .expect(201);
    expect(w.body.status).toBe('PENDING');
    const w2 = await srv()
      .patch(`/api/v1/food-dining/waiter-calls/${w.body.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ status: 'ACKNOWLEDGED' })
      .expect(200);
    expect(w2.body.status).toBe('ACKNOWLEDGED');
    const b = await srv()
      .post('/api/v1/food-dining/bill-requests')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        tableId: table.body.id,
      })
      .expect(201);
    expect(b.body.status).toBe('PENDING');
    const b2 = await srv()
      .patch(`/api/v1/food-dining/bill-requests/${b.body.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ status: 'ACKNOWLEDGED' })
      .expect(200);
    expect(b2.body.status).toBe('ACKNOWLEDGED');
  });

  it('bill/waiter from conversation require branch context on BUSINESS_QR', async () => {
    const { ownerTok, tenantId } = await seedFoodTenant();
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
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
    const billTry = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '2' })
      .expect(200);
    expect(billTry.body.reply).toMatch(/branch|QR|tawi/i);
    const count = await prisma.billRequest.count();
    expect(count).toBe(0);
  });
});
