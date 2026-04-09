import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiningOrderStatus } from '@prisma/client';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PatchDiningOrderDto {
  @ApiPropertyOptional({ enum: DiningOrderStatus })
  @IsOptional()
  @IsEnum(DiningOrderStatus)
  status?: DiningOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  taxCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}
