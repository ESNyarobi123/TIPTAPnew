import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

describe('Phase 2 — auth, tenants, branches (e2e)', () => {
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

  it('register → login → me', async () => {
    const reg = await srv()
      .post('/api/v1/auth/register')
      .send({
        email: 'first@tiptap.test',
        password: PASS,
        firstName: 'First',
        lastName: 'User',
      })
      .expect(201);
    expect(reg.body.user.email).toBe('first@tiptap.test');
    expect(reg.body.accessToken).toBeDefined();

    const login = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'first@tiptap.test', password: PASS })
      .expect(200);
    expect(login.body.accessToken).toBeDefined();

    const me = await srv()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe('first@tiptap.test');
    expect(me.body.roles.some((r: { role: string }) => r.role === 'SUPER_ADMIN')).toBe(
      true,
    );
  });

  it('login fails with wrong password', async () => {
    await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'u@tiptap.test', password: PASS })
      .expect(201);
    await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'u@tiptap.test', password: 'WrongPass1x' })
      .expect(401);
  });

  it('inactive user cannot login', async () => {
    await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'a@tiptap.test', password: PASS })
      .expect(201);
    const reg2 = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'inactive@tiptap.test', password: PASS })
      .expect(201);
    await prisma.user.update({
      where: { id: reg2.body.user.id },
      data: { isActive: false },
    });
    await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@tiptap.test', password: PASS })
      .expect(401);
  });

  it('refresh token flow rotates and issues new pair', async () => {
    const reg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'ref@tiptap.test', password: PASS })
      .expect(201);
    const r1 = await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(200);
    expect(r1.body.accessToken).toBeDefined();
    expect(r1.body.refreshToken).toBeDefined();
    expect(r1.body.refreshToken).not.toBe(reg.body.refreshToken);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(401);
  });

  it('logout-all revokes every refresh token for user', async () => {
    const reg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'allout@tiptap.test', password: PASS })
      .expect(201);
    await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'allout@tiptap.test', password: PASS })
      .expect(200);
    const login2 = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'allout@tiptap.test', password: PASS })
      .expect(200);
    await srv()
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${login2.body.accessToken}`)
      .expect(200);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(401);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login2.body.refreshToken })
      .expect(401);
  });

  it('logout revokes refresh token', async () => {
    const reg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'out@tiptap.test', password: PASS })
      .expect(201);
    await srv()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(200);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(401);
  });

  it('super admin can create tenant with owner', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'sa@tiptap.test', password: PASS })
      .expect(201);
    const bob = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'bob@tiptap.test', password: PASS })
      .expect(201);

    const t = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Acme Co',
        slug: 'acme-co',
        ownerUserId: bob.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    expect(t.body.slug).toBe('acme-co');
    expect(t.body.categories).toHaveLength(1);
  });

  it('tenant owner can fetch own tenant only in list', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 's2@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'own@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Owned',
        slug: 'owned-co',
        ownerUserId: owner.body.user.id,
      })
      .expect(201);

    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'own@tiptap.test', password: PASS })
      .expect(200);

    const list = await srv()
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(tenant.body.id);

    const one = await srv()
      .get(`/api/v1/tenants/${tenant.body.id}`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .expect(200);
    expect(one.body.slug).toBe('owned-co');
  });

  it('tenant owner cannot fetch another tenant', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 's3@tiptap.test', password: PASS })
      .expect(201);
    const alice = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'alice@tiptap.test', password: PASS })
      .expect(201);
    const bob = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'bob2@tiptap.test', password: PASS })
      .expect(201);

    const tB = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({ name: 'Tenant B', slug: 'tenant-b', ownerUserId: bob.body.user.id })
      .expect(201);
    await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({ name: 'Tenant A', slug: 'tenant-a', ownerUserId: alice.body.user.id })
      .expect(201);

    const aliceLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'alice@tiptap.test', password: PASS })
      .expect(200);

    await srv()
      .get(`/api/v1/tenants/${tB.body.id}`)
      .set('Authorization', `Bearer ${aliceLogin.body.accessToken}`)
      .expect(403);
  });

  it('tenant owner can create branch under tenant', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 's4@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'br@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'Branchy',
        slug: 'branchy-co',
        ownerUserId: owner.body.user.id,
      })
      .expect(201);

    const tok = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'br@tiptap.test', password: PASS })
      .expect(200);

    const br = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${tok.body.accessToken}`)
      .send({
        name: 'Main',
        code: 'M1',
      })
      .expect(201);
    expect(br.body.code).toBe('M1');
  });

  it('cross-tenant branch create fails', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 's5@tiptap.test', password: PASS })
      .expect(201);
    const alice = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'al5@tiptap.test', password: PASS })
      .expect(201);
    const bob = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'bo5@tiptap.test', password: PASS })
      .expect(201);

    const tBob = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({ name: 'BobCo', slug: 'bob-co-5', ownerUserId: bob.body.user.id })
      .expect(201);
    await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({ name: 'AliCo', slug: 'ali-co-5', ownerUserId: alice.body.user.id })
      .expect(201);

    const aliceTok = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'al5@tiptap.test', password: PASS })
      .expect(200);

    await srv()
      .post(`/api/v1/tenants/${tBob.body.id}/branches`)
      .set('Authorization', `Bearer ${aliceTok.body.accessToken}`)
      .send({
        name: 'Evil',
        code: 'X1',
      })
      .expect(403);
  });

  it('refresh token reuse revokes all outstanding refresh tokens for user', async () => {
    const reg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'reuse@tiptap.test', password: PASS })
      .expect(201);
    const loginA = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'reuse@tiptap.test', password: PASS })
      .expect(200);
    const loginB = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'reuse@tiptap.test', password: PASS })
      .expect(200);
    const r1 = await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(200);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken })
      .expect(401);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginA.body.refreshToken })
      .expect(401);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginB.body.refreshToken })
      .expect(401);
    await srv()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r1.body.refreshToken })
      .expect(401);
  });
});
