import { PartialType } from '@nestjs/swagger';
import { CreateStaffCompensationDto } from './create-staff-compensation.dto';

export class UpdateStaffCompensationDto extends PartialType(CreateStaffCompensationDto) {}
