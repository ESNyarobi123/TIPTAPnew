import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: 'Opaque refresh token (not JWT)' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
