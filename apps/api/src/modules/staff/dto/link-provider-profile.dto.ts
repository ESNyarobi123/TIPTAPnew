import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode, StaffAssignmentMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LinkProviderProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiProperty({ description: 'Global provider code (for example TIP-PABC123) or public slug' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  providerCode!: string;

  @ApiPropertyOptional({ enum: StaffAssignmentMode })
  @IsOptional()
  @IsEnum(StaffAssignmentMode)
  mode?: StaffAssignmentMode;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  roleInTenant?: RoleCode;
}
