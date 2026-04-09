import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaileysAdapter } from './adapters/baileys.adapter';
import { WhatsappSessionStoreService } from './whatsapp-session-store.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly log = new Logger(WhatsappService.name);
  private readonly adapter = new BaileysAdapter();
  private enabled = false;
  private bootState: 'disabled' | 'booting' | 'ready' | 'error' = 'disabled';
  private lastError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly sessions: WhatsappSessionStoreService,
  ) {}

  async onModuleInit() {
    this.enabled = this.config.get<string>('WHATSAPP_ENABLED', 'false') === 'true';
    if (!this.enabled) {
      this.bootState = 'disabled';
      this.log.log('WhatsApp channel disabled (set WHATSAPP_ENABLED=true to enable)');
      return;
    }
    this.bootState = 'booting';
    const authDir = this.config.get<string>('WHATSAPP_AUTH_DIR', '.wa-auth');
    this.log.log(`Connecting WhatsApp (authDir=${authDir})`);

    void this.adapter
      .connect({
        authDir,
        onInbound: (m) => void this.onInbound(m.from, m.text),
      })
      .then(() => {
        this.bootState = 'ready';
        this.lastError = null;
        this.log.log('WhatsApp adapter connected (scan QR in terminal if prompted)');
      })
      .catch((e) => {
        this.bootState = 'error';
        this.lastError = e instanceof Error ? e.message : String(e);
        this.log.error(`WhatsApp adapter failed: ${e instanceof Error ? e.message : String(e)}`);
      });
  }

  private apiBase(): string {
    const base = this.config.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1').replace(/\/$/, '');
    return base;
  }

  private defaultLanguage(): string {
    const lang = this.config.get<string>('WHATSAPP_DEFAULT_LANGUAGE', 'sw');
    return lang === 'en' || lang === 'sw' ? lang : 'sw';
  }

  private entryInstructions(): string {
    return [
      'Karibu TIPTAP.',
      'Scan QR ya biashara, meza, station, au provider kisha fungua WhatsApp.',
      'Kama ujumbe umejazwa tayari, gusa Send.',
      'Au tuma mwenyewe kwa format hii:',
      'QR:<token>',
      '',
      'Mfano: QR:Abc123...',
    ].join('\n');
  }


  private parseQrToken(text: string): string | null {
    const t = text.trim();
    if (!t) return null;
    const m = t.match(/(?:^|\s)(?:qr|QR)\s*[:=]?\s*([A-Za-z0-9_\-]{20,})\s*$/);
    if (m?.[1]) return m[1];
    if (/^[A-Za-z0-9_\-]{20,}$/.test(t)) return t;
    return null;
  }

  private async startSession(from: string, qrToken: string): Promise<{ sessionToken: string; firstReply: string }> {
    const startRes = await fetch(`${this.apiBase()}/conversations/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrToken,
        channel: 'WHATSAPP',
        language: this.defaultLanguage(),
        externalCustomerId: from,
      }),
    });
    if (!startRes.ok) {
      const txt = await startRes.text();
      throw new Error(txt || `Start failed (${startRes.status})`);
    }
    const start = (await startRes.json()) as { sessionToken?: string };
    if (!start.sessionToken) {
      throw new Error('Start did not return sessionToken');
    }

    const firstReply = await this.sendMessage(start.sessionToken, 'hi');
    return { sessionToken: start.sessionToken, firstReply };
  }

  private async sendMessage(sessionToken: string, text: string, newQrToken?: string): Promise<string> {
    const res = await fetch(`${this.apiBase()}/conversations/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        text,
        ...(newQrToken ? { newQrToken } : {}),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Message failed (${res.status})`);
    }
    const out = (await res.json()) as { reply?: string };
    return out.reply ?? 'OK';
  }

  private isExpiredOrUnauthorized(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      msg.includes('410') ||
      lower.includes('expired') ||
      lower.includes('unauthorized') ||
      lower.includes('invalid session token')
    );
  }

  private async onInbound(from: string, text: string) {
    const qrToken = this.parseQrToken(text);
    try {
      await this.sessions.withSenderLock(from, async () => {
        const existing = await this.sessions.getSession(from);
        if (!existing) {
          if (!qrToken) {
            await this.adapter.sendText(from, this.entryInstructions());
            return;
          }

          const started = await this.startSession(from, qrToken);
          await this.sessions.setSession(from, {
            token: started.sessionToken,
            lastUsedAt: Date.now(),
          });
          await this.adapter.sendText(from, started.firstReply);
          return;
        }

        const reply = qrToken
          ? await this.sendMessage(existing.token, 'hi', qrToken)
          : await this.sendMessage(existing.token, text);

        await this.sessions.setSession(from, { token: existing.token, lastUsedAt: Date.now() });
        await this.adapter.sendText(from, reply);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Inbound handler error for ${from}: ${msg}`);

      if (msg.toLowerCase().includes('sender lock timeout')) {
        await this.adapter.sendText(from, 'Subiri sekunde chache, tunaendelea kusawazisha ujumbe wako.');
        return;
      }

      if (this.isExpiredOrUnauthorized(msg)) {
        await this.sessions.deleteSession(from);
        if (qrToken) {
          try {
            const restarted = await this.startSession(from, qrToken);
            await this.sessions.setSession(from, {
              token: restarted.sessionToken,
              lastUsedAt: Date.now(),
            });
            await this.adapter.sendText(from, restarted.firstReply);
            return;
          } catch (restartError) {
            this.log.warn(
              `Session restart failed for ${from}: ${restartError instanceof Error ? restartError.message : String(restartError)}`,
            );
          }
        }
      }

      await this.adapter.sendText(
        from,
        'Samahani — kuna tatizo kidogo. Tafadhali scan QR upya. Kama WhatsApp imefunguka na ujumbe tayari, gusa Send. Au tuma: QR:<token>',
      );
    }
  }

  async sendAdminText(to: string, text: string) {
    if (!this.enabled) {
      throw new Error('WhatsApp channel disabled (set WHATSAPP_ENABLED=true)');
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    await this.adapter.sendText(to, trimmed);
  }

  getAdminStatus() {
    const adapter = this.adapter.getStatus();
    return {
      ok: true,
      service: 'bot-gateway',
      channel: 'whatsapp',
      whatsappEnabled: this.enabled,
      bootState: this.bootState,
      connected: adapter.connected,
      connectionState: adapter.connectionState,
      canSend: this.enabled && adapter.connected,
      lastError: this.lastError,
    };
  }
}
