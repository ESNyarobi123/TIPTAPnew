import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

@Controller('admin')
export class BotGatewayAdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsappService,
  ) {}

  private assertAdminKey(req: any) {
    const expected = this.config.get<string>('BOT_GATEWAY_ADMIN_KEY', '');
    if (!expected) {
      throw new ForbiddenException('BOT_GATEWAY_ADMIN_KEY not configured');
    }
    const provided = (req?.headers?.['x-admin-key'] ?? req?.headers?.['X-Admin-Key']) as string | undefined;
    if (!provided || provided !== expected) {
      throw new ForbiddenException('Invalid admin key');
    }
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  status() {
    return { ok: true, service: 'bot-gateway', channel: 'whatsapp' };
  }

  @Post('test-message')
  @HttpCode(HttpStatus.OK)
  async testMessage(
    @Req() req: any,
    @Body() body: { to: string; text: string },
  ) {
    this.assertAdminKey(req);
    const to = body?.to?.trim();
    const text = body?.text?.trim();
    if (!to || !text) {
      throw new ForbiddenException('to and text are required');
    }
    // Reuse the running WhatsApp connection (Baileys) to send a raw outbound message.
    // Note: caller is responsible for providing a valid WhatsApp JID/number format.
    await this.whatsapp.sendAdminText(to, text);
    return { ok: true };
  }
}

