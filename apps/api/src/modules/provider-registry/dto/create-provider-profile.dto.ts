import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollDisbursementMethod } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProviderProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  verifiedSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  publicSlug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Internal only — never returned on public endpoints' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  internalNotes?: string;

  @ApiPropertyOptional({ enum: PayrollDisbursementMethod })
  @IsOptional()
  @IsEnum(PayrollDisbursementMethod)
  payoutMethod?: PayrollDisbursementMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  payoutRecipientLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  payoutAccountMask?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  payoutNote?: string;
}
