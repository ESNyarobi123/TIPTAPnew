import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/request-user.type';
import { userIsSuperAdmin } from '../auth/types/request-user.type';

type BotGatewayStatus = {
  ok: boolean;
  baseUrl: string;
  gatewayReachable: boolean;
  adminKeyConfigured: boolean;
  service?: string;
  channel?: string;
  whatsappEnabled?: boolean;
  bootState?: string;
  connected?: boolean;
  connectionState?: string;
  canSend?: boolean;
  lastError?: string | null;
  note?: string;
};

@Injectable()
export class BotGatewayAdminService {
  constructor(private readonly config: ConfigService) {}

  private assertSuperAdmin(actor: AuthUser) {
    if (!userIsSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN only');
    }
  }

  private baseUrl(): string {
    return (this.config.get<string>('BOT_GATEWAY_BASE_URL') ?? 'http://localhost:3002').replace(/\/$/, '');
  }

  private adminKey(): string {
    return this.config.get<string>('BOT_GATEWAY_ADMIN_KEY') ?? '';
  }

  private friendlyOfflineMessage(): string {
    return `Bot gateway is offline at ${this.baseUrl()}. Start or rebuild the bot-gateway service, then try again.`;
  }

  private async requestGateway(path: string, init?: RequestInit) {
    try {
      return await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': this.adminKey(),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new ServiceUnavailableException(this.friendlyOfflineMessage());
    }
  }

  private async readGatewayResponse(res: Response) {
    const raw = await res.text();
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return { raw };
    }
  }

  async getStatus(actor: AuthUser): Promise<BotGatewayStatus> {
    this.assertSuperAdmin(actor);

    const adminKeyConfigured = Boolean(this.adminKey());
    if (!adminKeyConfigured) {
      return {
        ok: false,
        baseUrl: this.baseUrl(),
        gatewayReachable: false,
        adminKeyConfigured,
        note: 'BOT_GATEWAY_ADMIN_KEY is missing in the API environment.',
      };
    }

    try {
      const res = await this.requestGateway('/admin/status', { method: 'GET' });
      const body = (await this.readGatewayResponse(res)) as Record<string, unknown> | null;
      if (!res.ok) {
        const message =
          typeof body?.message === 'string'
            ? body.message
            : `Bot gateway returned ${res.status}`;
        return {
          ok: false,
          baseUrl: this.baseUrl(),
          gatewayReachable: false,
          adminKeyConfigured,
          note: message,
        };
      }

      return {
        ok: true,
        baseUrl: this.baseUrl(),
        gatewayReachable: true,
        adminKeyConfigured,
        service: typeof body?.service === 'string' ? body.service : 'bot-gateway',
        channel: typeof body?.channel === 'string' ? body.channel : 'whatsapp',
        whatsappEnabled: typeof body?.whatsappEnabled === 'boolean' ? body.whatsappEnabled : undefined,
        bootState: typeof body?.bootState === 'string' ? body.bootState : undefined,
        connected: typeof body?.connected === 'boolean' ? body.connected : undefined,
        connectionState: typeof body?.connectionState === 'string' ? body.connectionState : undefined,
        canSend: typeof body?.canSend === 'boolean' ? body.canSend : undefined,
        lastError:
          typeof body?.lastError === 'string' || body?.lastError === null
            ? (body.lastError as string | null)
            : undefined,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return {
          ok: false,
          baseUrl: this.baseUrl(),
          gatewayReachable: false,
          adminKeyConfigured,
          note: error.message,
        };
      }
      throw error;
    }
  }

  async sendTestWhatsappMessage(actor: AuthUser, to: string, text: string) {
    this.assertSuperAdmin(actor);
    if (!this.adminKey()) {
      throw new ServiceUnavailableException(
        'BOT_GATEWAY_ADMIN_KEY is missing in the API environment.',
      );
    }

    const res = await this.requestGateway('/admin/test-message', {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    });
    const json = (await this.readGatewayResponse(res)) as Record<string, unknown> | null;

    if (!res.ok) {
      const msg =
        typeof json?.message === 'string'
          ? json.message
          : `Bot gateway error (${res.status})`;
      throw new ServiceUnavailableException(msg);
    }
    return json ?? { ok: true };
  }
}
