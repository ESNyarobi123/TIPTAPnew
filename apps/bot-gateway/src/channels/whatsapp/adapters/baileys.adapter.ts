import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

type InboundMessage = {
  from: string;
  id: string;
  text: string;
};

type BaileysSocket = {
  ev: { on: (event: string, cb: (...args: unknown[]) => void) => void };
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
};

function readText(msg: { message?: unknown } | null | undefined): string {
  if (!msg) return '';
  const m = (msg as { message?: Record<string, unknown> }).message ?? msg;
  const rec = m as Record<string, unknown>;
  return (
    (typeof rec.conversation === 'string' ? rec.conversation : '') ||
    (typeof (rec.extendedTextMessage as Record<string, unknown> | undefined)?.text === 'string'
      ? String((rec.extendedTextMessage as { text: string }).text)
      : '') ||
    (typeof (rec.imageMessage as Record<string, unknown> | undefined)?.caption === 'string'
      ? String((rec.imageMessage as { caption: string }).caption)
      : '') ||
    (typeof (rec.videoMessage as Record<string, unknown> | undefined)?.caption === 'string'
      ? String((rec.videoMessage as { caption: string }).caption)
      : '') ||
    ''
  );
}

/**
 * WhatsApp via Baileys (Linked Devices / WhatsApp Web protocol).
 * @see https://baileys.wiki/docs/intro
 *
 * Note: `useMultiFileAuthState` is fine for dev; production should use a durable auth store
 * (see Baileys docs — do not rely on the demo helper at scale).
 */
export class BaileysAdapter {
  private sock: BaileysSocket | null = null;

  async connect(opts: { authDir: string; logger?: unknown; onInbound: (m: InboundMessage) => void }) {
    const { state, saveCreds } = await useMultiFileAuthState(opts.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock: BaileysSocket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: opts.logger as any,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldIgnoreJid: (jid: string) => jid.includes('@broadcast'),
    }) as BaileysSocket;
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u: unknown) => {
      type ConnectionUpdate = {
        connection?: string;
        lastDisconnect?: { error?: { output?: { statusCode?: number } } };
      };
      const update = u as ConnectionUpdate;
      if (update?.connection === 'close') {
        const statusCode = update?.lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          void this.connect(opts).catch(() => undefined);
        }
      }
    });

    sock.ev.on('messages.upsert', (upsert: unknown) => {
      const u = upsert as { messages?: unknown[] };
      const arr = Array.isArray(u?.messages) ? u.messages : [];
      for (const m of arr) {
        const msg = m as { key?: { fromMe?: boolean; remoteJid?: string; id?: string }; message?: unknown };
        if (!msg || msg.key?.fromMe) continue;
        const from = msg.key?.remoteJid;
        if (typeof from !== 'string' || !from) continue;
        const id = String(msg.key?.id ?? '');
        const text = readText(msg);
        if (!text) continue;
        opts.onInbound({ from, id, text });
      }
    });
  }

  async sendText(to: string, text: string) {
    if (!this.sock) {
      throw new Error('WhatsApp socket not connected');
    }
    const trimmed = text.length > 4000 ? `${text.slice(0, 3990)}…` : text;
    await this.sock.sendMessage(to, { text: trimmed });
  }
}
