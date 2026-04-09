import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiningOrderItemStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PatchDiningOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ enum: DiningOrderItemStatus })
  @IsOptional()
  @IsEnum(DiningOrderItemStatus)
  status?: DiningOrderItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
