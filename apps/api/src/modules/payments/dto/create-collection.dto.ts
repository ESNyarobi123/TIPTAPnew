import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCollectionDto {
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

  @ApiProperty({ description: 'MSISDN for USSD push' })
  @IsString()
  @MinLength(5)
  phoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Idempotent replay when the same reference is sent again' })
  @IsOptional()
  @IsString()
  orderReference?: string;
}
