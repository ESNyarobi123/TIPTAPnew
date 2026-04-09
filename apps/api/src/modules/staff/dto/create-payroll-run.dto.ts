import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePayrollRunDto {
  @ApiProperty({ description: 'Tenant scope for the payroll run' })
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Optional branch scope for the payroll run' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  branchId?: string;

  @ApiProperty({ description: 'Human-friendly period label (e.g. Apr 2026)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  periodLabel!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
