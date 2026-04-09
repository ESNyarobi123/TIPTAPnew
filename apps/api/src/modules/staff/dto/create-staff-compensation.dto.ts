import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffCompensationStatus, StaffCompensationType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateStaffCompensationDto {
  @ApiPropertyOptional({ description: 'Optional branch scope for the pay record' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  branchId?: string;

  @ApiPropertyOptional({ enum: StaffCompensationType })
  @IsOptional()
  @IsEnum(StaffCompensationType)
  type?: StaffCompensationType;

  @ApiPropertyOptional({ enum: StaffCompensationStatus })
  @IsOptional()
  @IsEnum(StaffCompensationStatus)
  status?: StaffCompensationStatus;

  @ApiProperty({ description: 'Amount in minor units' })
  @IsInt()
  @Min(0)
  amountCents!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  periodLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
