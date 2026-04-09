import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';

@Injectable()
export class BotGatewayAdminService {
  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    // Align with apps/bot-gateway (Next admin often uses 3001; gateway .env.example commonly uses 3002).
    return (this.config.get<string>('BOT_GATEWAY_BASE_URL') ?? 'http://localhost:3002').replace(/\/$/, '');
  }

  private adminKey(): string {
    return this.config.get<string>('BOT_GATEWAY_ADMIN_KEY') ?? '';
  }

  async sendTestWhatsappMessage(actor: AuthUser, to: string, text: string) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN only');
    }
    if (!this.adminKey()) {
      throw new ForbiddenException('Bot gateway admin key not configured');
    }
    const res = await fetch(`${this.baseUrl()}/admin/test-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': this.adminKey(),
      },
      body: JSON.stringify({ to, text }),
    });
    const raw = await res.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = { raw };
    }
    if (!res.ok) {
      const msg = typeof json?.message === 'string' ? json.message : raw || `Bot gateway error (${res.status})`;
      throw new ForbiddenException(msg);
    }
    return json ?? { ok: true };
  }
}

