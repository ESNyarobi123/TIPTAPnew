import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 8 — KDS + QDS tokens (e2e)', () => {
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

  it('KDS: create token, public GET orders + PATCH item status', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p8-fs@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p8-fo@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'P8 Food',
        slug: 'p8-food',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p8-fo@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'KDS' })
      .expect(201);

    const tok = await srv()
      .post('/api/v1/food-dining/kds/tokens')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        name: 'Line 1',
      })
      .expect(201);
    expect(tok.body.rawToken).toBeDefined();
    expect(tok.body.name).toBe('Line 1');

    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ tenantId: tenant.body.id, name: 'X', sortOrder: 0 })
      .expect(201);
    const mi = await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        categoryId: cat.body.id,
        name: 'Item',
        priceCents: 100,
        currency: 'USD',
        isAvailable: true,
      })
      .expect(201);
    const order = await srv()
      .post('/api/v1/food-dining/orders')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        items: [{ menuItemId: mi.body.id, quantity: 1 }],
      })
      .expect(201);
    const itemId = order.body.items[0].id as string;

    const live = await srv()
      .get(`/api/v1/food-dining/kds/${encodeURIComponent(tok.body.rawToken)}/orders`)
      .expect(200);
    expect(Array.isArray(live.body)).toBe(true);
    expect(live.body.length).toBe(1);

    const patched = await srv()
      .patch(`/api/v1/food-dining/kds/${encodeURIComponent(tok.body.rawToken)}/items/${itemId}`)
      .send({ status: 'PREPARING' })
      .expect(200);
    expect(patched.body.status).toBe('PREPARING');

    const list = await srv()
      .get(`/api/v1/food-dining/kds/tokens?tenantId=${tenant.body.id}`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(200);
    expect(list.body.some((r: { id: string }) => r.id === tok.body.id)).toBe(true);
  });

  it('QDS: create token, public queue + providers', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p8-bs@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p8-bo@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'P8 Beauty',
        slug: 'p8-beauty',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p8-bo@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'QDS' })
      .expect(201);

    const tok = await srv()
      .post('/api/v1/beauty-grooming/qds/tokens')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        name: 'Lobby',
      })
      .expect(201);
    expect(tok.body.rawToken).toBeDefined();

    const queue = await srv()
      .get(`/api/v1/beauty-grooming/qds/${encodeURIComponent(tok.body.rawToken)}/queue`)
      .expect(200);
    expect(queue.body.waiting).toEqual([]);
    expect(queue.body.inService).toEqual([]);
    expect(Array.isArray(queue.body.upcoming)).toBe(true);

    const prov = await srv()
      .get(`/api/v1/beauty-grooming/qds/${encodeURIComponent(tok.body.rawToken)}/providers`)
      .expect(200);
    expect(prov.body.branchId).toBe(branch.body.id);
    expect(Array.isArray(prov.body.providers)).toBe(true);
  });
});
