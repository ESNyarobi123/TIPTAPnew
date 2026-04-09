import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationChannel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ description: 'Opaque QR secret (same as /qr/resolve).' })
  @IsString()
  @MinLength(16)
  qrToken!: string;

  @ApiPropertyOptional({ enum: ['en', 'sw'] })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;

  @ApiPropertyOptional({ enum: ConversationChannel })
  @IsOptional()
  @IsEnum(ConversationChannel)
  channel?: ConversationChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalCustomerId?: string;
}
