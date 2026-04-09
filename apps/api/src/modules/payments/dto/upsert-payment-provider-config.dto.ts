import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertPaymentProviderConfigDto {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiPropertyOptional({ default: 'ClickPesa' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ description: 'ClickPesa client id' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiProperty({ description: 'ClickPesa API key (stored encrypted)' })
  @IsString()
  @MinLength(1)
  apiKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksumKey?: string;

  @ApiPropertyOptional({ description: 'Shared secret for webhook verification' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  collectionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  payoutEnabled?: boolean;
}
