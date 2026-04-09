import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode, StaffEmploymentStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  roleInTenant?: RoleCode;

  @ApiPropertyOptional({ enum: StaffEmploymentStatus })
  @IsOptional()
  @IsEnum(StaffEmploymentStatus)
  status?: StaffEmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  publicHandle?: string | null;

  @ApiPropertyOptional({ description: 'Internal-only notes (current employer admins + SUPER_ADMIN)' })
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  privateNotes?: string | null;
}
