import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

function sessionHash(sessionToken: string): string {
  return createHash('sha256').update(sessionToken.trim(), 'utf8').digest('hex');
}

const PASS = 'SecurePass1ab';

describe('Phase 3 — staff, provider, QR, conversations (e2e)', () => {
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

  async function seedTenantWithFood() {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'psa@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'poa@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Food Co',
        slug: 'food-co',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'poa@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'B1', code: 'B1' })
      .expect(201);
    return {
      superTok: superReg.body.accessToken,
      ownerTok: ownerLogin.body.accessToken,
      tenantId: tenant.body.id as string,
      branchId: branch.body.id as string,
    };
  }

  it('create staff under tenant', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Alex Server' })
      .expect(201);
    expect(st.body.displayName).toBe('Alex Server');
    expect(st.body.tenantId).toBe(tenantId);
  });

  it('assign staff to valid branch', async () => {
    const { ownerTok, tenantId, branchId } = await seedTenantWithFood();
    const st = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'Sam' })
      .expect(201);
    const a = await srv()
      .post(`/api/v1/staff/${st.body.id}/assignments`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ branchId })
      .expect(201);
    expect(a.body.branchId).toBe(branchId);
  });

  it('cross-tenant staff assignment fails', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'sct@tiptap.test', password: PASS })
      .expect(201);
    const o1 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'o1@tiptap.test', password: PASS })
      .expect(201);
    const o2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'o2@tiptap.test', password: PASS })
      .expect(201);
    const t1 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({ name: 'T1', slug: 't1-x', ownerUserId: o1.body.user.id })
      .expect(201);
    const t2 = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({ name: 'T2', slug: 't2-x', ownerUserId: o2.body.user.id })
      .expect(201);
    const login1 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'o1@tiptap.test', password: PASS })
      .expect(200);
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'o2@tiptap.test', password: PASS })
      .expect(200);
    const b2 = await srv()
      .post(`/api/v1/tenants/${t2.body.id}/branches`)
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .send({ name: 'Bx', code: 'X' })
      .expect(201);
    const staff = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${login1.body.accessToken}`)
      .send({ tenantId: t1.body.id, displayName: 'Wrong' })
      .expect(201);
    await srv()
      .post(`/api/v1/staff/${staff.body.id}/assignments`)
      .set('Authorization', `Bearer ${login1.body.accessToken}`)
      .send({ branchId: b2.body.id })
      .expect(400);
  });

  it('create provider registry profile', async () => {
    const { ownerTok } = await seedTenantWithFood();
    const p = await srv()
      .post('/api/v1/provider-registry')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({
        displayName: 'Pro Vendor',
        skills: ['cuts', 'color'],
      })
      .expect(201);
    expect(p.body.displayName).toBe('Pro Vendor');
    const pub = await srv().get(`/api/v1/provider-registry/${p.body.id}/public`).expect(200);
    expect(pub.body.skills).toEqual(['cuts', 'color']);
    expect(pub.body.internalNotes).toBeUndefined();
  });

  it('create QR for BUSINESS_QR and STAFF_QR and resolve', async () => {
    const { ownerTok, tenantId, branchId } = await seedTenantWithFood();
    const staff = await srv()
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, displayName: 'QR Staff' })
      .expect(201);
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR', branchId })
      .expect(201);
    expect(b.body.rawToken).toBeDefined();
    const s = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'STAFF_QR', staffId: staff.body.id })
      .expect(201);
    const resB = await srv()
      .post('/api/v1/qr/resolve')
      .send({ token: b.body.rawToken })
      .expect(200);
    expect(resB.body.valid).toBe(true);
    expect(resB.body.context.type).toBe('BUSINESS_QR');
    const resS = await srv()
      .post('/api/v1/qr/resolve')
      .send({ token: s.body.rawToken })
      .expect(200);
    expect(resS.body.context.type).toBe('STAFF_QR');
  });

  it('revoked QR cannot be resolved', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    await srv()
      .post(`/api/v1/qr/${b.body.id}/revoke`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    await srv()
      .post('/api/v1/qr/resolve')
      .send({ token: b.body.rawToken })
      .expect(404);
  });

  it('rotated QR invalidates old token', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    const rot = await srv()
      .post(`/api/v1/qr/${b.body.id}/rotate`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .expect(200);
    await srv()
      .post('/api/v1/qr/resolve')
      .send({ token: b.body.rawToken })
      .expect(404);
    const ok = await srv()
      .post('/api/v1/qr/resolve')
      .send({ token: rot.body.rawToken })
      .expect(200);
    expect(ok.body.valid).toBe(true);
  });

  it('start conversation from resolved QR context', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: b.body.rawToken, language: 'en' })
      .expect(201);
    expect(start.body.sessionToken).toBeDefined();
    expect(start.body.sessionId).toBeUndefined();
    expect(start.body.expiresAt).toBeDefined();
  });

  it('create QR via tenant-scoped path', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post(`/api/v1/tenants/${tenantId}/qr`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ type: 'BUSINESS_QR' })
      .expect(201);
    expect(b.body.rawToken).toBeDefined();
    expect(b.body.tenantId).toBe(tenantId);
  });

  it('send message 1 and receive category-aware menu (BEAUTY_GROOMING)', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'pbeauty@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'obeauty@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Glow',
        slug: 'glow-co',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'obeauty@tiptap.test', password: PASS })
      .expect(200);
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ tenantId: tenant.body.id, type: 'BUSINESS_QR' })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: b.body.rawToken })
      .expect(201);
    const msg = await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '1',
      })
      .expect(200);
    expect(msg.body.reply).toMatch(/services|huduma/i);
  });

  it('send message 1 and receive category-aware menu (FOOD_DINING)', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: b.body.rawToken })
      .expect(201);
    const msg = await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '1',
      })
      .expect(200);
    expect(msg.body.reply).toMatch(/View menu|Tazama menyu/i);
    expect(msg.body.session.currentState).toBe('MAIN_MENU');
  });

  it('send 0 and verify back behavior', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: b.body.rawToken })
      .expect(201);
    await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '1',
      })
      .expect(200);
    const back = await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '0',
      })
      .expect(200);
    expect(back.body.reply).toMatch(/already at the main menu|Tayari uko/i);
  });

  it('language switch updates session', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: b.body.rawToken })
      .expect(201);
    await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '1',
      })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '7',
      })
      .expect(200);
    await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '2',
      })
      .expect(200);
    const sess = await srv()
      .get('/api/v1/conversations/session')
      .set('X-Session-Token', start.body.sessionToken)
      .expect(200);
    expect(sess.body.language).toBe('sw');
  });

  it('expired session rejects message with 410', async () => {
    const { ownerTok, tenantId } = await seedTenantWithFood();
    const b = await srv()
      .post('/api/v1/qr')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ tenantId, type: 'BUSINESS_QR' })
      .expect(201);
    const start = await srv()
      .post('/api/v1/conversations/start')
      .send({ qrToken: b.body.rawToken })
      .expect(201);
    const row = await prisma.conversationSession.findFirstOrThrow({
      where: { clientTokenHash: sessionHash(start.body.sessionToken) },
    });
    await prisma.conversationSession.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await srv()
      .post('/api/v1/conversations/message')
      .send({
        sessionToken: start.body.sessionToken,
        text: '1',
      })
      .expect(410);
  });
});
