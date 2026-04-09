import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode, StaffAssignmentMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BulkCreateStaffDto {
  @ApiProperty({ description: 'Tenant to create staff in' })
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiProperty({ description: 'Branch to auto-link staff into' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiPropertyOptional({ enum: StaffAssignmentMode })
  @IsOptional()
  @IsEnum(StaffAssignmentMode)
  mode?: StaffAssignmentMode;

  @ApiPropertyOptional({ enum: RoleCode, default: RoleCode.SERVICE_STAFF })
  @IsOptional()
  @IsEnum(RoleCode)
  roleInTenant?: RoleCode;

  @ApiProperty({
    description:
      'Paste lines of staff. Supported formats: "Name, +2557..." or "+2557..." or "Name +2557..." (one per line).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  lines!: string;
}

