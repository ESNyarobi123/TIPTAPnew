import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/types/request-user.type';
import { RoleCode } from '@prisma/client';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'List users (SUPER_ADMIN)' })
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile (self or SUPER_ADMIN)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.findOnePublic(id, user);
  }

  @Post(':id/role-assignments')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Grant role assignment (SUPER_ADMIN)' })
  assignRole(@Param('id') id: string, @Body() body: AssignRoleDto, @CurrentUser() user: AuthUser) {
    return this.users.assignRole(id, user, body);
  }

  @Delete(':id/role-assignments/:assignmentId')
  @Roles(RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke role assignment (SUPER_ADMIN)' })
  revokeRole(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.revokeRole(id, assignmentId, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile (self or SUPER_ADMIN)' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.update(id, user, body);
  }
}
