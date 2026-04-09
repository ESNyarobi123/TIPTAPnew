import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePayoutDto {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty({ example: 'TZS' })
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiProperty({ description: 'Provider payout payload (e.g. account / phone fields)' })
  @IsObject()
  payoutPayload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderReference?: string;
}
