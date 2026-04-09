import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentTransactionStatus, PaymentTransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  branchId?: string;

  @ApiPropertyOptional({ description: 'ISO date (defaults to 30 days before endDate)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO date (defaults to now)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class AnalyticsPaymentsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: PaymentTransactionType })
  @IsOptional()
  @IsEnum(PaymentTransactionType)
  type?: PaymentTransactionType;

  @ApiPropertyOptional({ enum: PaymentTransactionStatus })
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  status?: PaymentTransactionStatus;
}

export class AnalyticsTipsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  staffId?: string;
}

export class AnalyticsRatingsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  lowScoreMax?: number;
}
