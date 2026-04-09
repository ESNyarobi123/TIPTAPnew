import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchBillRequestDto {
  @ApiPropertyOptional({ enum: BillRequestStatus })
  @IsOptional()
  @IsEnum(BillRequestStatus)
  status?: BillRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
