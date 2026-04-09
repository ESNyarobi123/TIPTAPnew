import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 9 — customer portal tokens (e2e)', () => {
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

  it('DiningOrder: mint portal token, public GET, revoke → 404', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p9-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p9-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'P9 Food',
        slug: 'p9-food',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p9-o@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'P9' })
      .expect(201);

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
        name: 'Burger',
        priceCents: 500,
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

    const mint = await srv()
      .post(`/api/v1/food-dining/orders/${order.body.id}/portal-token`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(201);
    expect(mint.body.rawToken).toBeDefined();
    expect(mint.body.id).toBe(order.body.id);

    const pub = await srv()
      .get(`/api/v1/food-dining/order-portal/${encodeURIComponent(mint.body.rawToken)}`)
      .expect(200);
    expect(pub.body.orderNumber).toBeDefined();
    expect(pub.body.items[0].name).toBe('Burger');

    await srv()
      .delete(`/api/v1/food-dining/orders/${order.body.id}/portal-token`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(204);

    await srv()
      .get(`/api/v1/food-dining/order-portal/${encodeURIComponent(mint.body.rawToken)}`)
      .expect(404);
  });

  it('BeautyBooking: mint portal token, public GET', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p9-bs@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p9-bo@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'P9 Beauty',
        slug: 'p9-beauty',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p9-bo@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Main', code: 'B9' })
      .expect(201);

    const bc = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ tenantId: tenant.body.id, name: 'Hair', sortOrder: 0 })
      .expect(201);
    const svcRow = await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        categoryId: bc.body.id,
        name: 'Cut',
        priceCents: 2000,
        currency: 'USD',
        isAvailable: true,
      })
      .expect(201);

    const booking = await srv()
      .post('/api/v1/beauty-grooming/bookings')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        isWalkIn: true,
        services: [{ beautyServiceId: svcRow.body.id }],
      })
      .expect(201);

    const mint = await srv()
      .post(`/api/v1/beauty-grooming/bookings/${booking.body.id}/portal-token`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(201);
    expect(mint.body.rawToken).toBeDefined();

    const pub = await srv()
      .get(`/api/v1/beauty-grooming/booking-portal/${encodeURIComponent(mint.body.rawToken)}`)
      .expect(200);
    expect(pub.body.bookingNumber).toBeDefined();
    expect(pub.body.services.some((s: { name: string }) => s.name === 'Cut')).toBe(true);
  });
});
