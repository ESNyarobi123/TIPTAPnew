import { ApiPropertyOptional } from '@nestjs/swagger';
import { BeautyBookingServiceStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchBeautyBookingServiceDto {
  @ApiPropertyOptional({ enum: BeautyBookingServiceStatus })
  @IsOptional()
  @IsEnum(BeautyBookingServiceStatus)
  status?: BeautyBookingServiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
