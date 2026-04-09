import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, truncateAllTables } from './integration-bootstrap';
import { PrismaService } from '../src/database/prisma/prisma.service';

const PASS = 'SecurePass1ab';

/** 2026-01-05 is Monday UTC; 2026-01-10 is Saturday UTC */
const MON_OPEN = '2026-01-05T11:00:00.000Z';
const MON_CLOSED = '2026-01-05T18:00:00.000Z';
const SAT = '2026-01-10T11:00:00.000Z';

describe('Phase 11 — beauty scheduledAt vs branch operatingHours (e2e)', () => {
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
      .send({ email: 'p11-s@tiptap.test', password: PASS })
      .expect(201);
    const owner = await srv()
      .post('/api/v1/auth/register')
      .send({ email: 'p11-o@tiptap.test', password: PASS })
      .expect(201);
    const tenant = await srv()
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superReg.body.accessToken}`)
      .send({
        name: 'P11 Beauty',
        slug: 'p11-beauty',
        ownerUserId: owner.body.user.id,
        enabledCategories: ['BEAUTY_GROOMING'],
      })
      .expect(201);
    const ownerLogin = await srv()
      .post('/api/v1/auth/login')
      .send({ email: 'p11-o@tiptap.test', password: PASS })
      .expect(200);
    const branch = await srv()
      .post(`/api/v1/tenants/${tenant.body.id}/branches`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        name: 'Salon',
        code: 'S1',
        timezone: 'UTC',
        operatingHours: {
          mon: [{ open: '09:00', close: '17:00' }],
        },
      })
      .expect(201);
    return { ownerLogin, tenant, branch };
  }

  it('accepts scheduledAt inside hours; rejects outside hours or closed day', async () => {
    const { ownerLogin, tenant, branch } = await seedBeautyTenant();

    await srv()
      .post('/api/v1/beauty-grooming/bookings')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        scheduledAt: MON_OPEN,
        isWalkIn: false,
      })
      .expect(201);

    await srv()
      .post('/api/v1/beauty-grooming/bookings')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        scheduledAt: MON_CLOSED,
        isWalkIn: false,
      })
      .expect(400);

    await srv()
      .post('/api/v1/beauty-grooming/bookings')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        scheduledAt: SAT,
        isWalkIn: false,
      })
      .expect(400);
  });

  it('PATCH scheduledAt validated against hours', async () => {
    const { ownerLogin, tenant, branch } = await seedBeautyTenant();

    const booking = await srv()
      .post('/api/v1/beauty-grooming/bookings')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        tenantId: tenant.body.id,
        branchId: branch.body.id,
        scheduledAt: MON_OPEN,
        isWalkIn: false,
      })
      .expect(201);

    await srv()
      .patch(`/api/v1/beauty-grooming/bookings/${booking.body.id}`)
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ scheduledAt: MON_CLOSED })
      .expect(400);
  });
});
