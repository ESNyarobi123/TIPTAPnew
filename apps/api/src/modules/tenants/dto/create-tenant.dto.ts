import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessCategory, TenantStatus } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'URL-safe unique slug' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ description: 'Assign TENANT_OWNER to this user id' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: BusinessCategory,
    isArray: true,
    description: 'Categories to enable on create',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(BusinessCategory, { each: true })
  enabledCategories?: BusinessCategory[];
}
