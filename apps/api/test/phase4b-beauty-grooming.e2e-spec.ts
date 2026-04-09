import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 4B — BEAUTY_GROOMING data + conversation wiring (e2e)', () => {
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

  async function seedBeautyTenant() {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4b-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4b-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Salon Phase4B',
        slug: 'salon-p4b',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p4b-o@tiptap.test', password: PASS })
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

  it('create service category and beauty service; list tenant-safely', async () => {
    const { ownerTok, tenantId } = await seedBeautyTenant();
    const cat = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Hair', sortOrder: 1 })
      .expect(201);
    expect(cat.body.name).toBe('Hair');
    const svc = await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Cut & style',
        description: 'Full service',
        priceCents: 3500,
        currency: 'USD',
        durationMinutes: 45,
        isAvailable: true,
        displayOrder: 1,
      })
      .expect(201);
    expect(svc.body.priceCents).toBe(3500);
    expect(svc.body.durationMin).toBe(45);
    const list = await srv()
      .get(`/api/v1/beauty-grooming/service-categories?tenantId=${tenantId}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === cat.body.id)).toBe(true);
    const services = await srv()
      .get(`/api/v1/beauty-grooming/services?tenantId=${tenantId}&categoryId=${cat.body.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    expect(services.body).toHaveLength(1);
    expect(services.body[0].name).toBe('Cut & style');
  });

  it('create station and STATION_QR', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    const station = await srv()
      .post('/api/v1/beauty-grooming/stations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        code: 'S1',
        label: 'Chair 1',
      })
      .expect(201);
    expect(station.body.code).toBe('S1');
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
    expect(qr.body.rawToken).toBeDefined();
  });

  it('assign provider specialization', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    const staff = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        displayName: 'Alex Stylist',
      })
      .expect(201);
    const cat = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Color' })
      .expect(201);
    const spec = await srv()
      .post('/api/v1/beauty-grooming/specializations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        staffId: staff.body.id,
        title: 'Senior colorist',
        beautyServiceCategoryId: cat.body.id,
      })
      .expect(201);
    expect(spec.body.title).toBe('Senior colorist');
    expect(spec.body.beautyServiceCategoryId).toBe(cat.body.id);
  });

  it('conversation: categories, services with price/duration/availability; assistance', async () => {
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
        name: 'Manicure',
        priceCents: 2000,
        currency: 'USD',
        durationMinutes: 30,
        isAvailable: true,
      })
      .expect(201);
    await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Pedicure',
        priceCents: 2800,
        currency: 'USD',
        isAvailable: false,
      })
      .expect(201);
    const station = await srv()
      .post('/api/v1/beauty-grooming/stations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'N1' })
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
    const m2 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(m2.body.reply).toMatch(/Nails/);
    expect(m2.body.session.currentState).toBe('BEAUTY_MENU_CATEGORIES');

    const m3 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(m3.body.reply).toMatch(/Manicure/);
    expect(m3.body.reply).toMatch(/20\.00/);
    expect(m3.body.reply).toMatch(/30 min/);
    expect(m3.body.reply).toMatch(/unavailable/i);
    expect(m3.body.session.currentState).toBe('BEAUTY_MENU_SERVICES');

    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '0' })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '0' })
      .expect(200);

    const assist = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '2' })
      .expect(200);
    expect(assist.body.reply).toMatch(/reception|notified|mapokezi|arifa/i);

    const hash = createHash('sha256').update(tok.trim(), 'utf8').digest('hex');
    const sess = await prisma.conversationSession.findFirst({
      where: { clientTokenHash: hash },
    });
    expect(sess).toBeTruthy();
    const reqs = await prisma.assistanceRequest.findMany({ where: { sessionId: sess!.id } });
    expect(reqs.length).toBeGreaterThanOrEqual(1);
    expect(reqs[0].stationId).toBe(station.body.id);
    expect(reqs[0].status).toBe('PENDING');
  });

  it('language switch + real service menu (Swahili labels)', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    const cat = await srv()
      .post('/api/v1/beauty-grooming/service-categories')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, name: 'Spa' })
      .expect(201);
    await srv()
      .post('/api/v1/beauty-grooming/services')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        categoryId: cat.body.id,
        name: 'Massage',
        priceCents: 5000,
      })
      .expect(201);
    const station = await srv()
      .post('/api/v1/beauty-grooming/stations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'S9' })
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
      .send({ sessionToken: tok, text: '4' })
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
    expect(menu.body.reply).toMatch(/Makundi|huduma/i);
    expect(menu.body.reply).toMatch(/Spa/);
  });

  it('cross-tenant cannot read another tenant beauty-grooming resources', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4b-s2@tiptap.test', password: PASS })
      .expect(201);
    const o1 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4b-a@tiptap.test', password: PASS })
      .expect(201);
    const o2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p4b-b@tiptap.test', password: PASS })
      .expect(201);
    const t1 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Salon A',
        slug: 'p4b-ta',
        ownerUserId: o1.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Salon B',
        slug: 'p4b-tb',
        ownerUserId: o2.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p4b-b@tiptap.test', password: PASS })
      .expect(200);
    await srv()
      .get(`/api/v1/beauty-grooming/service-categories?tenantId=${t1.body.id}`)
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .expect(403);
  });

  it('STAFF_QR conversation shows provider-aware greeting', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    const staff = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        displayName: 'Jamie Pro',
      })
      .expect(201);
    const qr = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        type: 'STAFF_QR',
        staffId: staff.body.id,
      })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: qr.body.rawToken })
      .expect(201);
    const tok = start.body.sessionToken as string;
    const m1 = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '1' })
      .expect(200);
    expect(m1.body.reply).toMatch(/Jamie Pro/);
  });

  it('assistance from BUSINESS_QR without branch is blocked', async () => {
    const { ownerTok, tenantId } = await seedBeautyTenant();
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
    const assistTry = await srv()
      .post('/api/v1/conversations/message')
      .send({ sessionToken: tok, text: '2' })
      .expect(200);
    expect(assistTry.body.reply).toMatch(/branch|QR|tawi|station|kituo/i);
    const count = await prisma.assistanceRequest.count();
    expect(count).toBe(0);
  });

  it('assistance request API status lifecycle', async () => {
    const { ownerTok, tenantId, branchId } = await seedBeautyTenant();
    const station = await srv()
      .post('/api/v1/beauty-grooming/stations')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, branchId, code: 'Z1' })
      .expect(201);
    const r = await srv()
      .post('/api/v1/beauty-grooming/assistance-requests')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        tenantId,
        branchId,
        stationId: station.body.id,
      })
      .expect(201);
    expect(r.body.status).toBe('PENDING');
    const r2 = await srv()
      .patch(`/api/v1/beauty-grooming/assistance-requests/${r.body.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ status: 'ACKNOWLEDGED' })
      .expect(200);
    expect(r2.body.status).toBe('ACKNOWLEDGED');
  });
});
