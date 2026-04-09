import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssistanceRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchAssistanceRequestDto {
  @ApiPropertyOptional({ enum: AssistanceRequestStatus })
  @IsOptional()
  @IsEnum(AssistanceRequestStatus)
  status?: AssistanceRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}
