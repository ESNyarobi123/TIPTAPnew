import {
  BusinessCategory,
  PrismaClient,
  RoleCode,
  TenantStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const ROUNDS = 12;

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@tiptap.local';
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!123';
  const resetAdminPassword =
    process.env.SEED_RESET_ADMIN_PASSWORD === 'true' ||
    process.env.SEED_RESET_ADMIN_PASSWORD === '1';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { roleAssignments: true },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPass, ROUNDS),
        firstName: 'Super',
        lastName: 'Admin',
        passwordChangedAt: new Date(),
        roleAssignments: {
          create: [{ role: RoleCode.SUPER_ADMIN }],
        },
      },
    });
    console.log(`Created SUPER_ADMIN ${adminEmail} (password from SEED_ADMIN_PASSWORD)`);
  } else {
    const hasSuper = existingAdmin.roleAssignments.some((a) => a.role === RoleCode.SUPER_ADMIN);
    if (!hasSuper) {
      await prisma.userRoleAssignment.create({
        data: { userId: existingAdmin.id, role: RoleCode.SUPER_ADMIN },
      });
      console.log(`Granted SUPER_ADMIN to existing user ${adminEmail}`);
    }
    if (resetAdminPassword) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash: await bcrypt.hash(adminPass, ROUNDS),
          passwordChangedAt: new Date(),
        },
      });
      console.log(`Reset password for ${adminEmail} to match SEED_ADMIN_PASSWORD (SEED_RESET_ADMIN_PASSWORD=true)`);
    } else if (hasSuper) {
      console.log(
        `Admin ${adminEmail} already exists — password not changed. ` +
          `Use the password you chose at registration, or re-run seed with SEED_RESET_ADMIN_PASSWORD=true.`,
      );
    } else {
      console.log(
        `Granted SUPER_ADMIN to ${adminEmail}; password not changed. ` +
          `Set SEED_RESET_ADMIN_PASSWORD=true to set password to SEED_ADMIN_PASSWORD.`,
      );
    }
  }

  const foodSlug = 'harbor-bistro';
  if (!(await prisma.tenant.findUnique({ where: { slug: foodSlug } }))) {
    const owner = await prisma.user.create({
      data: {
        email: 'owner.harbor@tiptap.local',
        passwordHash: await bcrypt.hash('TenantOwner!123', ROUNDS),
        firstName: 'Harbor',
        lastName: 'Owner',
        passwordChangedAt: new Date(),
      },
    });

    const foodTenant = await prisma.tenant.create({
      data: {
        name: 'Harbor Bistro',
        slug: foodSlug,
        status: TenantStatus.ACTIVE,
        subscriptionPlan: 'starter',
        subscriptionStatus: 'active',
        branches: {
          create: {
            name: 'Waterfront',
            code: 'WF-01',
            city: 'Dar es Salaam',
            country: 'TZ',
          },
        },
        categories: {
          create: { category: BusinessCategory.FOOD_DINING, enabled: true },
        },
      },
    });

    const wfBranch = await prisma.branch.findFirstOrThrow({
      where: { tenantId: foodTenant.id, code: 'WF-01' },
    });

    await prisma.userRoleAssignment.create({
      data: {
        userId: owner.id,
        role: RoleCode.TENANT_OWNER,
        tenantId: foodTenant.id,
      },
    });

    const staffUser = await prisma.user.create({
      data: {
        email: 'staff.harbor@tiptap.local',
        passwordHash: await bcrypt.hash('ServiceStaff!123', ROUNDS),
        firstName: 'Jamal',
        lastName: 'Server',
        passwordChangedAt: new Date(),
      },
    });

    await prisma.staff.create({
      data: {
        tenantId: foodTenant.id,
        branchId: wfBranch.id,
        userId: staffUser.id,
        displayName: 'Jamal',
        roleInTenant: RoleCode.SERVICE_STAFF,
        publicHandle: 'harbor-jamal',
      },
    });

    const menuCat = await prisma.diningMenuCategory.create({
      data: {
        tenantId: foodTenant.id,
        branchId: wfBranch.id,
        name: 'Seafood',
        sortOrder: 1,
      },
    });

    await prisma.diningMenuItem.create({
      data: {
        tenantId: foodTenant.id,
        branchId: wfBranch.id,
        categoryId: menuCat.id,
        name: 'Grilled Prawns',
        priceCents: 18_500,
        currency: 'TZS',
      },
    });

    await prisma.diningTable.create({
      data: {
        tenantId: foodTenant.id,
        branchId: wfBranch.id,
        code: 'T12',
        label: 'Terrace 12',
      },
    });

    console.log('Seeded FOOD_DINING demo tenant:', foodSlug);
  }

  const beautySlug = 'studio-glow';
  if (!(await prisma.tenant.findUnique({ where: { slug: beautySlug } }))) {
    const owner = await prisma.user.create({
      data: {
        email: 'owner.glow@tiptap.local',
        passwordHash: await bcrypt.hash('TenantOwner!123', ROUNDS),
        firstName: 'Glow',
        lastName: 'Owner',
        passwordChangedAt: new Date(),
      },
    });

    const beautyTenant = await prisma.tenant.create({
      data: {
        name: 'Studio Glow',
        slug: beautySlug,
        status: TenantStatus.ACTIVE,
        subscriptionPlan: 'starter',
        branches: {
          create: {
            name: 'Main Studio',
            code: 'MG-01',
            city: 'Nairobi',
            country: 'KE',
          },
        },
        categories: {
          create: { category: BusinessCategory.BEAUTY_GROOMING, enabled: true },
        },
      },
    });

    const branch = await prisma.branch.findFirstOrThrow({
      where: { tenantId: beautyTenant.id, code: 'MG-01' },
    });

    await prisma.userRoleAssignment.create({
      data: {
        userId: owner.id,
        role: RoleCode.TENANT_OWNER,
        tenantId: beautyTenant.id,
      },
    });

    const cat = await prisma.beautyServiceCategory.create({
      data: {
        tenantId: beautyTenant.id,
        branchId: branch.id,
        name: 'Hair',
        sortOrder: 1,
      },
    });

    await prisma.beautyService.create({
      data: {
        tenantId: beautyTenant.id,
        branchId: branch.id,
        categoryId: cat.id,
        name: 'Cut & Style',
        durationMin: 45,
        priceCents: 350_000,
        currency: 'KES',
      },
    });

    await prisma.beautyStation.create({
      data: {
        tenantId: beautyTenant.id,
        branchId: branch.id,
        code: 'S3',
        label: 'Chair 3',
      },
    });

    console.log('Seeded BEAUTY_GROOMING demo tenant:', beautySlug);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
