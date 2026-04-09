import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class PatchTipDto {
  @ApiPropertyOptional({ enum: TipStatus })
  @IsOptional()
  @IsEnum(TipStatus)
  status?: TipStatus;
}
