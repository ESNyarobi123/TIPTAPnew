import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Omit for tenant-wide category' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'When false, category is hidden from active customer flows' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
