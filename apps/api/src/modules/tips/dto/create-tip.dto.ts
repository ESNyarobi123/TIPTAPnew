import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTipDto {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  staffId!: string;

  @ApiProperty({ enum: TipMode })
  @IsEnum(TipMode)
  mode!: TipMode;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Required when mode is DIGITAL (USSD push)' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Idempotent replay for digital tip payment row' })
  @IsOptional()
  @IsString()
  orderReference?: string;

  @ApiPropertyOptional({ description: 'Link tip to an open dining order (tenant + optional session)' })
  @IsOptional()
  @IsString()
  diningOrderId?: string;

  @ApiPropertyOptional({ description: 'Link tip to an open beauty booking (tenant + optional session)' })
  @IsOptional()
  @IsString()
  beautyBookingId?: string;
}
