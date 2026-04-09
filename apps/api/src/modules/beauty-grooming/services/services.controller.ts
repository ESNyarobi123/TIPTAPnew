import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthUser } from '../../auth/types/request-user.type';
import { BeautyGroomingAccessService } from '../beauty-grooming-access.service';
import type { BeautyGroomingRequestMeta } from '../service-categories/service-categories.service';
import { CreateBeautyServiceDto } from './dto/create-beauty-service.dto';
import { PatchBeautyServiceDto } from './dto/patch-beauty-service.dto';
import { TenantImageUploadService } from '../../uploads/tenant-image-upload.service';
import { ServicesService } from './services.service';

function bgMeta(req: Request): BeautyGroomingRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('beauty-grooming')
@ApiBearerAuth()
@Controller('beauty-grooming/services')
@UseGuards(RolesGuard)
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly beautyAccess: BeautyGroomingAccessService,
    private readonly uploads: TenantImageUploadService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload beauty service image (JPEG/PNG/WebP/GIF, max 5MB)',
    description:
      'Returns `path` for `imageUrl` and absolute `url`. Query: `tenantId`, optional `branchId`. Same rules as menu images.',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Req() req: Request,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    const bid = branchId?.trim() || null;
    await this.beautyAccess.assertCanManageCatalogRow(user, tid, bid);
    const out = this.uploads.save('beauty-services', tid, file);
    const host = req.get('host') ?? 'localhost';
    const base = `${req.protocol}://${host}`;
    return { path: out.path, url: `${base}/api/v1${out.path}` };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Create beauty service',
    description:
      'Write DTO uses `durationMinutes` and `isAvailable`; JSON responses echo Prisma (`durationMin`, `isActive`). Money: `priceCents` + `currency`, aligned with food-dining menu items.',
  })
  create(@Body() body: CreateBeautyServiceDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.services.create(user, body, bgMeta(req));
  }

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'List beauty services (tenantId; optional branchId, categoryId, activeOnly)',
    description:
      'Each row includes `durationMin`, `isActive`, `priceCents` (see domain model — PATCH body uses `durationMinutes` / `isAvailable`).',
  })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('activeOnly') activeOnly: string | undefined,
  ) {
    const tid = await this.beautyAccess.resolveTenantId(user, tenantId);
    return this.services.findAll(user, tid, {
      branchId,
      categoryId,
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Get(':id')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Get beauty service by id',
    description: 'Response shape is Prisma (`durationMin`, `isActive`, optional `priceCents`).',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.services.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update beauty service' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchBeautyServiceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.services.patch(user, id, body, bgMeta(req));
  }
}
