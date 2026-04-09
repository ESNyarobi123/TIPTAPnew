import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaileysAdapter } from './adapters/baileys.adapter';

type StoredSession = {
  token: string;
  lastUsedAt: number;
};

type PersistedSessionFile = {
  version: 1;
  sessions: Record<string, StoredSession>;
};

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly log = new Logger(WhatsappService.name);
  private readonly adapter = new BaileysAdapter();
  private readonly sessions = new Map<string, StoredSession>();
  private persistChain: Promise<void> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const enabled = this.config.get<string>('WHATSAPP_ENABLED', 'false') === 'true';
    if (!enabled) {
      this.log.log('WhatsApp channel disabled (set WHATSAPP_ENABLED=true to enable)');
      return;
    }

    await this.loadPersistedSessions();

    const authDir = this.config.get<string>('WHATSAPP_AUTH_DIR', '.wa-auth');
    this.log.log(`Connecting WhatsApp (authDir=${authDir})`);

    void this.adapter
      .connect({
        authDir,
        onInbound: (m) => void this.onInbound(m.from, m.text),
      })
      .then(() => this.log.log('WhatsApp adapter connected (scan QR in terminal if prompted)'))
      .catch((e) => {
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

  private sessionTtlMs(): number {
    return Number(this.config.get<string>('WHATSAPP_SESSION_TTL_MS', String(24 * 60 * 60 * 1000))) || 0;
  }

  private sessionStoreFile(): string {
    const raw = this.config.get<string>('WHATSAPP_SESSION_STORE_FILE', '.whatsapp-sessions.json');
    return resolve(process.cwd(), raw);
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

  private async loadPersistedSessions() {
    try {
      const raw = await readFile(this.sessionStoreFile(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedSessionFile>;
      const sessions = parsed.sessions ?? {};
      for (const [from, value] of Object.entries(sessions)) {
        if (!from || typeof value?.token !== 'string' || typeof value?.lastUsedAt !== 'number') {
          continue;
        }
        this.sessions.set(from, { token: value.token, lastUsedAt: value.lastUsedAt });
      }
      await this.cleanupSessions();
      if (this.sessions.size > 0) {
        this.log.log(`Restored ${this.sessions.size} WhatsApp session mapping(s) from disk`);
      }
    } catch (e) {
      const code = (e as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'ENOENT') {
        this.log.warn(`Could not load persisted WhatsApp sessions: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private async persistSessions() {
    const file = this.sessionStoreFile();
    const payload: PersistedSessionFile = {
      version: 1,
      sessions: Object.fromEntries(this.sessions.entries()),
    };
    this.persistChain = this.persistChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
      })
      .catch((e) => {
        this.log.warn(`Could not persist WhatsApp sessions: ${e instanceof Error ? e.message : String(e)}`);
      });
    await this.persistChain;
  }

  private async rememberSession(from: string, session: StoredSession) {
    this.sessions.set(from, session);
    await this.persistSessions();
  }

  private async forgetSession(from: string) {
    if (!this.sessions.delete(from)) {
      return;
    }
    await this.persistSessions();
  }

  private async cleanupSessions() {
    const ttlMs = this.sessionTtlMs();
    if (!ttlMs) return;
    const now = Date.now();
    let changed = false;
    for (const [from, session] of this.sessions.entries()) {
      if (now - session.lastUsedAt > ttlMs) {
        this.sessions.delete(from);
        changed = true;
      }
    }
    if (changed) {
      await this.persistSessions();
    }
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
    await this.cleanupSessions();

    const qrToken = this.parseQrToken(text);
    const existing = this.sessions.get(from);
    try {
      if (!existing) {
        if (!qrToken) {
          await this.adapter.sendText(from, this.entryInstructions());
          return;
        }

        const started = await this.startSession(from, qrToken);
        await this.rememberSession(from, { token: started.sessionToken, lastUsedAt: Date.now() });
        await this.adapter.sendText(from, started.firstReply);
        return;
      }

      const reply = qrToken
        ? await this.sendMessage(existing.token, 'hi', qrToken)
        : await this.sendMessage(existing.token, text);

      await this.rememberSession(from, { token: existing.token, lastUsedAt: Date.now() });
      await this.adapter.sendText(from, reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Inbound handler error for ${from}: ${msg}`);

      if (this.isExpiredOrUnauthorized(msg)) {
        await this.forgetSession(from);
        if (qrToken) {
          try {
            const restarted = await this.startSession(from, qrToken);
            await this.rememberSession(from, { token: restarted.sessionToken, lastUsedAt: Date.now() });
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
    const trimmed = text.trim();
    if (!trimmed) return;
    await this.adapter.sendText(to, trimmed);
  }
}
