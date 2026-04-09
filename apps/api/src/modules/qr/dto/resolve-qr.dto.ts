import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResolveQrDto {
  @ApiProperty({
    description:
      'Opaque secret from the QR payload. PublicRef alone is not accepted as trusted identity.',
  })
  @IsString()
  @MinLength(16)
  token!: string;
}
