import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { configLoaders } from './config';
import { validationSchema } from './config/validation.schema';
import { PrismaModule } from './database/prisma/prisma.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { BeautyGroomingModule } from './modules/beauty-grooming/beauty-grooming.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { FoodDiningModule } from './modules/food-dining/food-dining.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProviderRegistryModule } from './modules/provider-registry/provider-registry.module';
import { QrModule } from './modules/qr/qr.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { RolesModule } from './modules/roles/roles.module';
import { StatementsModule } from './modules/statements/statements.module';
import { StaffModule } from './modules/staff/staff.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TipsModule } from './modules/tips/tips.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      validationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>('redis.host'),
                port: config.get<number>('redis.port'),
                password: config.get<string>('redis.password') || undefined,
              },
            }),
            inject: [ConfigService],
          }),
        ]),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10_000,
        skipIf: () => process.env.NODE_ENV === 'test',
      },
    ]),
    PrismaModule,
    AdminModule,
    AuditLogsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    TenantsModule,
    BranchesModule,
    CategoriesModule,
    StaffModule,
    ProviderRegistryModule,
    QrModule,
    ConversationsModule,
    RatingsModule,
    TipsModule,
    PaymentsModule,
    StatementsModule,
    ReconciliationModule,
    AnalyticsModule,
    FoodDiningModule,
    BeautyGroomingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
