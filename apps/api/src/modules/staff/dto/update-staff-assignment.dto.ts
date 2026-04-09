import { ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAssignmentMode, StaffAssignmentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateStaffAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  endedAt?: Date;

  @ApiPropertyOptional({ enum: StaffAssignmentStatus })
  @IsOptional()
  @IsEnum(StaffAssignmentStatus)
  status?: StaffAssignmentStatus;

  @ApiPropertyOptional({ enum: StaffAssignmentMode })
  @IsOptional()
  @IsEnum(StaffAssignmentMode)
  mode?: StaffAssignmentMode;
}
