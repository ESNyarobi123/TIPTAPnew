import { OmitType } from '@nestjs/swagger';
import { CreateBranchDto } from './create-branch.dto';

export class CreateBranchNestedDto extends OmitType(CreateBranchDto, ['tenantId'] as const) {}
