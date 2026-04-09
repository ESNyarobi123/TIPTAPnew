import { ApiProperty } from '@nestjs/swagger';
import type { DiningOrderItemStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class PatchKdsItemDto {
  @ApiProperty({ enum: ['PENDING', 'PREPARING', 'READY'] })
  @IsIn(['PENDING', 'PREPARING', 'READY'])
  status!: DiningOrderItemStatus;
}
