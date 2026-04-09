import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSpecializationDto {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  staffId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Link to a beauty service category' })
  @IsOptional()
  @IsString()
  beautyServiceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Link to a specific beauty service' })
  @IsOptional()
  @IsString()
  beautyServiceId?: string;
}
