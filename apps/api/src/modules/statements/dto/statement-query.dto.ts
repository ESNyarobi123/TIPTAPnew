import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class StatementQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  branchId?: string;

  @ApiProperty({ description: 'ISO period start' })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'ISO period end' })
  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class StatementGenerateDto extends StatementQueryDto {}
