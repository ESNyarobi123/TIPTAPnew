import { ApiProperty } from '@nestjs/swagger';
import { BeautyBookingStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PatchQdsBookingDto {
  @ApiProperty({ enum: BeautyBookingStatus })
  @IsEnum(BeautyBookingStatus)
  status!: BeautyBookingStatus;
}
