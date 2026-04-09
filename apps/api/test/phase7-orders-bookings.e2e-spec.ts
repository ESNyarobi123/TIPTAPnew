import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 7 — DiningOrder + BeautyBooking (e2e)', () => {
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
      .send({ email: 'p7-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p7-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Bistro Phase7',
        slug: 'bistro-p7',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p7-o@tiptap.test', password: PASS })
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
      .send({ email: 'p7-bs@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p7-bo@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Salon Phase7',
        slug: 'salon-p7',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p7-bo@tiptap.test', password: PASS })
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

  it('FOOD: create order with lines; patch item status; list orders', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
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
        name: 'Rice bowl',
        priceCents: 1200,
        currency: 'USD',
        isAvailable: true,
      })
      .expect(201);

    const order = await srv()
      .post('/api/v1/food-dining/orders')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        items: [{ menuItemId: item.body.id, quantity: 2 }],
      })
      .expect(201);
    expect(order.body.orderNumber).toMatch(/^ORD-/);
    expect(order.body.totalCents).toBe(2400);
    expect(order.body.items).toHaveLength(1);

    await srv()
      .patch(`/api/v1/food-dining/orders/${order.body.id}/items/${order.body.items[0].id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ status: 'PREPARING' })
      .expect(200);

    const listed = await srv()
      .get(`/api/v1/food-dining/orders?tenantId=${tenantId}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(listed.body.some((o: { id: string }) => o.id === order.body.id)).toBe(true);

    const one = await srv()
      .get(`/api/v1/food-dining/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(one.body.items[0].status).toBe('PREPARING');
  });

  it('FOOD: conversation adds line to DiningOrder from TABLE_QR', async () => {
    const { ownerTok, tenantId, branchId } = await seedFoodTenant();
    const cat = await srv()
      .post('/api/v1/food-dining/menu-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Quick', sortOrder: 0 })
      .expect(201);
    await srv()
      .post('/api/v1/food-dining/menu-items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Snack',
        priceCents: 300,
        currency: 'USD',
        isAvailable: true,
      })
      .expect(201);
    const table = await srv()
      .post('/api/v1/food-dining/tables')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'P7' })
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
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    const pickItem = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(pickItem.body.reply).toMatch(/Snack|order/i);
    expect(pickItem.body.reply).toMatch(/ORD-/);

    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirst({
      where: { clientTokenHash: hash },
    });
    expect(sess).toBeTruthy();
    const orders = await prisma.diningOrder.findMany({
      where: { sessionId: sess!.id },
      include: { items: true },
    });
    expect(orders.length).toBe(1);
    expect(orders[0].items.length).toBe(1);
    expect(orders[0].diningTableId).toBe(table.body.id);
  });

  it('BEAUTY: create booking with services; check-in; list by date', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    const cat = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Hair', sortOrder: 0 })
      .expect(201);
    const svc = await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Trim',
        priceCents: 1500,
        currency: 'USD',
        durationMinutes: 20,
        isAvailable: true,
      })
      .expect(201);

    const booking = await srv()
      .post('/api/v1/beauty-grooming/bookings')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        customerName: 'Ada',
        scheduledAt: '2026-06-15T14:00:00.000Z',
        isWalkIn: false,
        services: [{ beautyServiceId: svc.body.id }],
      })
      .expect(201);
    expect(booking.body.bookingNumber).toMatch(/^BKG-/);
    expect(booking.body.status).toBe('BOOKED');
    expect(booking.body.services).toHaveLength(1);
    expect(booking.body.totalCents).toBe(1500);

    const checked = await srv()
      .post(`/api/v1/beauty-grooming/bookings/${booking.body.id}/check-in`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(checked.body.status).toBe('CHECKED_IN');
    expect(checked.body.checkedInAt).toBeTruthy();

    const dayList = await srv()
      .get(`/api/v1/beauty-grooming/bookings?tenantId=${tenantId}&date=2026-06-15`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(dayList.body.some((b: { id: string }) => b.id === booking.body.id)).toBe(true);
  });

  it('BEAUTY: conversation adds BeautyBookingService from STATION_QR', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
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
      .send({ tenantId, branchId, code: 'P7' })
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
    const pick = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(pick.body.reply).toMatch(/Polish|Added/i);
    expect(pick.body.reply).toMatch(/BKG-/);

    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirst({
      where: { clientTokenHash: hash },
    });
    expect(sess).toBeTruthy();
    const bookings = await prisma.beautyBooking.findMany({
      where: { sessionId: sess!.id },
      include: { services: true },
    });
    expect(bookings.length).toBe(1);
    expect(bookings[0].services.length).toBe(1);
    expect(bookings[0].stationId).toBe(station.body.id);
    expect(bookings[0].status).toBe('CHECKED_IN');
  });
});
