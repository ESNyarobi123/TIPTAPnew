import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaiterCallStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchWaiterCallDto {
  @ApiPropertyOptional({ enum: WaiterCallStatus })
  @IsOptional()
  @IsEnum(WaiterCallStatus)
  status?: WaiterCallStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
