import { ApiProperty } from '@nestjs/swagger';
import { PayrollRunStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePayrollRunStatusDto {
  @ApiProperty({ enum: PayrollRunStatus })
  @IsEnum(PayrollRunStatus)
  status!: PayrollRunStatus;
}
