import { ApiPropertyOptional } from '@nestjs/swagger';
import { BeautyBookingStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchBeautyBookingDto {
  @ApiPropertyOptional({ enum: BeautyBookingStatus })
  @IsOptional()
  @IsEnum(BeautyBookingStatus)
  status?: BeautyBookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
