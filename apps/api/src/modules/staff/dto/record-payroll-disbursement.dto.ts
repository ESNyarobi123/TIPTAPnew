import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollDisbursementMethod, PayrollDisbursementStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordPayrollDisbursementDto {
  @ApiProperty({ enum: PayrollDisbursementMethod })
  @IsEnum(PayrollDisbursementMethod)
  method!: PayrollDisbursementMethod;

  @ApiPropertyOptional({ enum: PayrollDisbursementStatus })
  @IsOptional()
  @IsEnum(PayrollDisbursementStatus)
  status?: PayrollDisbursementStatus;

  @ApiPropertyOptional({ description: 'Amount in minor units; defaults to remaining net amount' })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountMask?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  recipientLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proofNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
