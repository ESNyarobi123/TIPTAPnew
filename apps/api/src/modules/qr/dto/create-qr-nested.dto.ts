import { OmitType } from '@nestjs/swagger';
import { CreateQrDto } from './create-qr.dto';

export class CreateQrNestedDto extends OmitType(CreateQrDto, ['tenantId'] as const) {}
