import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type StoredWhatsappSession = {
  token: string;
  lastUsedAt: number;
};

@Injectable()
export class WhatsappSessionStoreService implements OnModuleDestroy {
  private readonly log = new Logger(WhatsappSessionStoreService.name);
  private redis: Redis | null = null;
  private redisPromise: Promise<Redis> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  private prefix() {
    return this.config.get<string>('WHATSAPP_REDIS_PREFIX', 'tiptap:whatsapp');
  }

  private sessionTtlSeconds() {
    const ttlMs =
      Number(this.config.get<string>('WHATSAPP_SESSION_TTL_MS', String(24 * 60 * 60 * 1000))) || 0;
    return Math.max(60, Math.ceil(ttlMs / 1000));
  }

  private sessionKey(from: string) {
    return `${this.prefix()}:session:${from}`;
  }

  private lockKey(from: string) {
    return `${this.prefix()}:lock:${from}`;
  }

  private async client() {
    if (this.redis) {
      return this.redis;
    }
    if (!this.redisPromise) {
      this.redisPromise = (async () => {
        const redis = new Redis({
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(this.config.get<string>('REDIS_PORT', '6379')),
          password: this.config.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
        redis.on('error', (error) => {
          this.log.warn(`Redis session store error: ${error.message}`);
        });
        await redis.connect();
        this.redis = redis;
        return redis;
      })().catch((error) => {
        this.redisPromise = null;
        throw error;
      });
    }
    return this.redisPromise;
  }

  async getSession(from: string): Promise<StoredWhatsappSession | null> {
    const redis = await this.client();
    const raw = await redis.get(this.sessionKey(from));
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as StoredWhatsappSession;
      if (typeof parsed.token !== 'string' || typeof parsed.lastUsedAt !== 'number') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async setSession(from: string, session: StoredWhatsappSession) {
    const redis = await this.client();
    await redis.set(
      this.sessionKey(from),
      JSON.stringify(session),
      'EX',
      this.sessionTtlSeconds(),
    );
  }

  async deleteSession(from: string) {
    const redis = await this.client();
    await redis.del(this.sessionKey(from));
  }

  async withSenderLock<T>(from: string, work: () => Promise<T>): Promise<T> {
    const redis = await this.client();
    const token = randomUUID();
    const ttlMs = 15_000;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const acquired = await redis.set(this.lockKey(from), token, 'PX', ttlMs, 'NX');
      if (acquired === 'OK') {
        try {
          return await work();
        } finally {
          await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
            1,
            this.lockKey(from),
            token,
          );
        }
      }
      await delay(150);
    }

    throw new Error('Sender lock timeout');
  }
}
