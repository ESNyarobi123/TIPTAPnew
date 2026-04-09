import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConversationMessageDto {
  @ApiProperty({ description: 'Opaque session token from POST /conversations/start (not the internal DB id).' })
  @IsString()
  @MinLength(16)
  sessionToken!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  text!: string;

  @ApiPropertyOptional({ description: 'If set, re-resolves QR and switches session context (same tenant only).' })
  @IsOptional()
  @IsString()
  @MinLength(16)
  newQrToken?: string;
}
