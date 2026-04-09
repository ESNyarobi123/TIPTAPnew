import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchStaffQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Search by phone, handle, email, or name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  q?: string;
}

