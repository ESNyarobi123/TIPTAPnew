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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RatingTargetType, RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { CreateRatingDto } from './dto/create-rating.dto';
import { PatchRatingDto } from './dto/patch-rating.dto';
import type { RatingsRequestMeta } from './ratings.service';
import { RatingsService } from './ratings.service';

function ratingMeta(req: Request): RatingsRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('ratings')
@ApiBearerAuth()
@Controller('ratings')
@UseGuards(RolesGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Create or update-within-window rating (session-scoped)' })
  create(@Body() body: CreateRatingDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.ratings.create(user, body, ratingMeta(req));
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
  @ApiOperation({ summary: 'List ratings for tenant (optional filters)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId: string,
    @Query('sessionId') sessionId?: string,
    @Query('targetType') targetType?: RatingTargetType,
  ) {
    return this.ratings.findAll(user, tenantId, { sessionId, targetType });
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
  @ApiOperation({ summary: 'Get rating by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ratings.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Patch rating within policy window' })
  patch(
    @Param('id') id: string,
    @Body() body: PatchRatingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.ratings.patch(user, id, body, ratingMeta(req));
  }
}
