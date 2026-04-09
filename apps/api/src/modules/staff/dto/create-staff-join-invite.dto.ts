import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAssignmentMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateStaffJoinInviteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiPropertyOptional({ enum: ['SERVICE_STAFF', 'CASHIER', 'SUPPORT_AGENT'], default: 'SERVICE_STAFF' })
  @IsOptional()
  @IsIn(['SERVICE_STAFF', 'CASHIER', 'SUPPORT_AGENT'])
  roleInTenant?: 'SERVICE_STAFF' | 'CASHIER' | 'SUPPORT_AGENT';

  @ApiPropertyOptional({ enum: StaffAssignmentMode })
  @IsOptional()
  @IsEnum(StaffAssignmentMode)
  mode?: StaffAssignmentMode;

  @ApiPropertyOptional({ description: 'Max redemptions (1–100)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Hours until expiry (1–720); omit for no expiry' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours?: number;
}
