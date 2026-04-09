import { ApiProperty } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ enum: RoleCode })
  @IsEnum(RoleCode)
  role!: RoleCode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  branchId?: string;
}

