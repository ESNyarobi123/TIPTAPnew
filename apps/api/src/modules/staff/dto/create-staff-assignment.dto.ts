import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAssignmentMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffAssignmentDto {
  @ApiProperty({ description: 'Branch to assign; must belong to staff tenant' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  startedAt?: Date;

  @ApiPropertyOptional({ enum: StaffAssignmentMode })
  @IsOptional()
  @IsEnum(StaffAssignmentMode)
  mode?: StaffAssignmentMode;
}
