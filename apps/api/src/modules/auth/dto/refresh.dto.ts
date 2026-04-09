import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Opaque refresh token returned from login/register' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
