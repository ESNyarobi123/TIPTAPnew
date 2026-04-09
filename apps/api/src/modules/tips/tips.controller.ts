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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateTipDto } from './dto/create-tip.dto';
import { PatchTipDto } from './dto/patch-tip.dto';
import { TipsService } from './tips.service';

@ApiTags('tips')
@ApiBearerAuth()
@Controller('tips')
@UseGuards(RolesGuard)
export class TipsController {
  constructor(private readonly tips: TipsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER, RoleCode.CASHIER)
  @ApiOperation({ summary: 'Record cash tip or start digital tip (ClickPesa USSD)' })
  create(@Body() body: CreateTipDto, @CurrentUser() user: AuthUser) {
    return this.tips.create(user, body);
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
  findAll(@Query('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.tips.findAll(user, tenantId);
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
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tips.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  patch(@Param('id') id: string, @Body() body: PatchTipDto, @CurrentUser() user: AuthUser) {
    return this.tips.patch(user, id, body);
  }
}
