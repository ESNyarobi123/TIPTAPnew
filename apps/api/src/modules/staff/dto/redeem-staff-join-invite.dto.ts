import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemStaffJoinInviteDto {
  @ApiProperty({ description: 'Join code from your manager (e.g. TT-AB12CD34)' })
  @IsString()
  @MinLength(6)
  @MaxLength(48)
  code!: string;
}
