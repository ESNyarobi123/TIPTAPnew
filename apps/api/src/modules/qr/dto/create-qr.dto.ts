import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QrType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateQrDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @IsEnum(QrType)
  type!: QrType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diningTableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  beautyStationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
