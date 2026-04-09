import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { BranchesService, type BranchRequestMeta } from './branches.service';
import { UpdateBranchDto } from './dto/update-branch.dto';

function branchMeta(req: Request): BranchRequestMeta {
  return {
    correlationId: req.correlationId,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(RolesGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get(':id')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.TENANT_OWNER,
    RoleCode.BRANCH_MANAGER,
    RoleCode.CASHIER,
    RoleCode.SERVICE_STAFF,
    RoleCode.SUPPORT_AGENT,
  )
  @ApiOperation({ summary: 'Get branch by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.branches.findOne(user, id);
  }

  @Patch(':id')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.TENANT_OWNER, RoleCode.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Update branch' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.branches.update(user, id, body, branchMeta(req));
  }
}
