import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RatingTargetType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ description: 'Conversation session id (required for idempotency / anti-duplicate).' })
  @IsString()
  @MinLength(1)
  sessionId!: string;

  @ApiProperty({ enum: RatingTargetType })
  @IsEnum(RatingTargetType)
  targetType!: RatingTargetType;

  @ApiProperty({ description: 'BUSINESS → tenantId; STAFF/PROVIDER_EXPERIENCE → staffId; SERVICE → menu item or beauty service id.' })
  @IsString()
  @MinLength(1)
  targetId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}
