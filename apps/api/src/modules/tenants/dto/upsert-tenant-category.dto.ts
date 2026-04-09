import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';

export class UpsertTenantCategoryDto {
  @ApiProperty({ enum: BusinessCategory })
  @IsEnum(BusinessCategory)
  category!: BusinessCategory;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
