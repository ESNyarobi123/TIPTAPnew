import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

const VALID_HOURS = {
  mon: [{ open: '09:00', close: '12:00' }],
  tue: [{ open: '10:00', close: '18:00' }],
};

describe('Phase 10 — branch operating hours (e2e)', () => {
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

  it('create with hours, public GET, PATCH clear, invalid hours 400', async () => {
    const superReg = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p10-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p10-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'P10 Biz',
        slug: 'p10-biz',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['FOOD_DINING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p10-o@tiptap.test', password: PASS })
      .expect(200);

    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        name: 'Main',
        code: 'M1',
        operatingHours: VALID_HOURS,
      })
      .expect(201);
    expect(branch.body.operatingHours).toEqual(VALID_HOURS);

    const pub = await srv().get(`/api/v1/public/branches/${branch.body.id}`).expect(200);
    expect(pub.body.name).toBe('Main');
    expect(pub.body.operatingHours).toEqual(VALID_HOURS);
    expect(pub.body.tenantId).toBeUndefined();

    await srv()
      .patch(`/api/v1/branches/${branch.body.id}`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ operatingHours: { xyz: [] } })
      .expect(400);

    await srv()
      .patch(`/api/v1/branches/${branch.body.id}`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ operatingHours: null })
      .expect(200);

    const pub2 = await srv().get(`/api/v1/public/branches/${branch.body.id}`).expect(200);
    expect(pub2.body.operatingHours).toBeNull();
  });
});
