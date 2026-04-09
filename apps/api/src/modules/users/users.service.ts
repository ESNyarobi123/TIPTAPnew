import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { AssignRoleDto } from './dto/assign-role.dto';
import { TenantAccessService } from '../tenants/tenant-access.service';
import { AuditService } from '../audit-logs/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { roleAssignments: true },
      take: 500,
    });
    return rows.map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      return {
        id: u.id,
        email: u.email,
        name: name || u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isActive: u.isActive,
        createdAt: u.createdAt,
        roles: u.roleAssignments.map((a) => ({
          id: a.id,
          role: a.role,
          tenantId: a.tenantId,
          branchId: a.branchId,
          createdAt: a.createdAt,
        })),
      };
    });
  }

  async assignRole(userId: string, actor: AuthUser, dto: AssignRoleDto) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.access.assertRoleAssignmentShape(dto.role, dto.tenantId, dto.branchId);
    if (dto.role !== 'SUPER_ADMIN' && dto.tenantId && dto.branchId) {
      await this.access.assertBranchBelongsToTenant(dto.branchId, dto.tenantId);
    }

    const exists = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        role: dto.role as RoleCode,
        tenantId: dto.tenantId ?? null,
        branchId: dto.branchId ?? null,
      },
    });
    if (exists) {
      throw new ConflictException('Role assignment already exists');
    }

    const created = await this.prisma.userRoleAssignment.create({
      data: {
        userId,
        role: dto.role as RoleCode,
        tenantId: dto.tenantId ?? null,
        branchId: dto.branchId ?? null,
      },
    });

    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'UserRoleAssignment',
      entityId: created.id,
      actorUserId: actor.userId,
      tenantId: dto.tenantId ?? undefined,
      branchId: dto.branchId ?? undefined,
      summary: 'Granted role assignment',
      details: { targetUserId: userId, role: dto.role, tenantId: dto.tenantId ?? null, branchId: dto.branchId ?? null },
    });

    return created;
  }

  async revokeRole(userId: string, assignmentId: string, actor: AuthUser) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN required');
    }
    const row = await this.prisma.userRoleAssignment.findFirst({ where: { id: assignmentId, userId } });
    if (!row) {
      throw new NotFoundException('Role assignment not found');
    }
    await this.prisma.userRoleAssignment.delete({ where: { id: assignmentId } });
    await this.audit.write({
      action: 'CONFIG_CHANGE',
      entityType: 'UserRoleAssignment',
      entityId: assignmentId,
      actorUserId: actor.userId,
      tenantId: row.tenantId ?? undefined,
      branchId: row.branchId ?? undefined,
      summary: 'Revoked role assignment',
      details: { targetUserId: userId, role: row.role, tenantId: row.tenantId, branchId: row.branchId },
    });
    return { success: true };
  }

  async findOnePublic(id: string, actor: AuthUser) {
    if (id !== actor.userId && !userIsSuperAdmin(actor)) {
      throw new ForbiddenException('Cannot access this user');
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roleAssignments: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return {
      id: user.id,
      email: user.email,
      name: name || user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      roles: user.roleAssignments.map((a) => ({
        role: a.role,
        tenantId: a.tenantId,
        branchId: a.branchId,
      })),
    };
  }

  async update(id: string, actor: AuthUser, dto: UpdateUserDto) {
    if (id !== actor.userId && !userIsSuperAdmin(actor)) {
      throw new ForbiddenException('Cannot update this user');
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
        phone: dto.phone ?? undefined,
      },
      include: { roleAssignments: true },
    });
    const name = [updated.firstName, updated.lastName].filter(Boolean).join(' ').trim();
    return {
      id: updated.id,
      email: updated.email,
      name: name || updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      isActive: updated.isActive,
      roles: updated.roleAssignments.map((a) => ({
        role: a.role,
        tenantId: a.tenantId,
        branchId: a.branchId,
      })),
    };
  }
}
