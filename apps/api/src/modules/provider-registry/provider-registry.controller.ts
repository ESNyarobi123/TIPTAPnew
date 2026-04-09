import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateProviderProfileDto } from './dto/create-provider-profile.dto';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { UpsertMyProviderProfileDto } from './dto/upsert-my-provider-profile.dto';
import { ProviderRegistryService, type ProviderRequestMeta } from './provider-registry.service';

function meta(req: Request): ProviderRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('provider-registry')
@Controller('provider-registry')
@UseGuards(RolesGuard)
export class ProviderRegistryController {
  constructor(private readonly registry: ProviderRegistryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Create portable provider profile' })
  create(@Body() body: CreateProviderProfileDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.registry.create(user, body, meta(req));
  }

  @Get('self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user provider identity' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.registry.findMine(user);
  }

  @Post('self')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update current user provider identity' })
  upsertMine(
    @Body() body: UpsertMyProviderProfileDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.registry.upsertMine(user, body, meta(req));
  }

  @Get('lookup/:code')
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Resolve provider by global provider code or public slug' })
  lookupByCode(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.registry.lookupByCode(user, code);
  }

  @Get(':id/public')
  @Public()
  @ApiOperation({ summary: 'Public shareable profile (no secrets)' })
  findPublic(@Param('id') id: string) {
    return this.registry.findOnePublic(id);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Internal profile (tenant-linked TENANT_OWNER / SUPER_ADMIN)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.registry.findOneInternal(user, id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER)
  @ApiOperation({ summary: 'Update profile (including internal fields)' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateProviderProfileDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.registry.update(user, id, body, meta(req));
  }
}
