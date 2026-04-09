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
import { FoodDiningAccessService } from '../food-dining-access.service';
import type { FoodDiningRequestMeta } from '../menu-categories/menu-categories.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { PatchMenuItemDto } from './dto/patch-menu-item.dto';
import { TenantImageUploadService } from '../../uploads/tenant-image-upload.service';
import { MenuItemsService } from './menu-items.service';

function fdMeta(req: Request): FoodDiningRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('food-dining')
@ApiBearerAuth()
@Controller('food-dining/menu-items')
@UseGuards(RolesGuard)
export class MenuItemsController {
  constructor(
    private readonly items: MenuItemsService,
    private readonly foodAccess: FoodDiningAccessService,
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
    summary: 'Upload menu item image (JPEG/PNG/WebP/GIF, max 5MB)',
    description:
      'Returns `path` to store in `imageUrl` (relative to `/api/v1`) and absolute `url`. Query: `tenantId`, optional `branchId` for branch-scoped managers.',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Req() req: Request,
  ) {
    const tid = await this.foodAccess.resolveTenantId(user, tenantId);
    const bid = branchId?.trim() || null;
    await this.foodAccess.assertCanManageMenuRow(user, tid, bid);
    const out = this.uploads.save('menu', tid, file);
    const host = req.get('host') ?? 'localhost';
    const base = `${req.protocol}://${host}`;
    return { path: out.path, url: `${base}/api/v1${out.path}` };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Create dining menu item' })
  create(@Body() body: CreateMenuItemDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.items.create(user, body, fdMeta(req));
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
  @ApiOperation({ summary: 'List menu items' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('activeOnly') activeOnly: string | undefined,
  ) {
    const tid = await this.foodAccess.resolveTenantId(user, tenantId);
    return this.items.findAll(user, tid, {
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
  @ApiOperation({ summary: 'Get menu item by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.items.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update menu item' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchMenuItemDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.items.patch(user, id, body, fdMeta(req));
  }
}
