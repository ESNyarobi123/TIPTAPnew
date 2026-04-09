import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAYS)[number];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) {
    return -1;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Validates `operatingHours` JSON for Branch. Keys: mon..sun; each day is an array of { open, close } in 24h HH:mm.
 */
export function assertOperatingHoursJson(value: unknown): Prisma.InputJsonValue {
  if (value === null) {
    throw new BadRequestException('operatingHours cannot be null on create');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('operatingHours must be a JSON object');
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!DAYS.includes(key as DayKey)) {
      throw new BadRequestException(
        `operatingHours: invalid key "${key}" (allowed: ${DAYS.join(', ')})`,
      );
    }
  }
  const out: Record<string, { open: string; close: string }[]> = {};
  for (const day of DAYS) {
    if (!(day in obj)) {
      continue;
    }
    const intervals = obj[day];
    if (!Array.isArray(intervals)) {
      throw new BadRequestException(`operatingHours.${day} must be an array`);
    }
    out[day] = [];
    for (const iv of intervals) {
      if (typeof iv !== 'object' || iv === null || Array.isArray(iv)) {
        throw new BadRequestException(`operatingHours.${day}: each interval must be an object`);
      }
      const row = iv as Record<string, unknown>;
      if (typeof row.open !== 'string' || typeof row.close !== 'string') {
        throw new BadRequestException(`operatingHours.${day}: intervals need string open and close (HH:mm)`);
      }
      const open = row.open.trim();
      const close = row.close.trim();
      if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
        throw new BadRequestException(`operatingHours.${day}: times must be HH:mm (24h)`);
      }
      const oMin = toMinutes(open);
      const cMin = toMinutes(close);
      if (oMin < 0 || cMin < 0 || oMin >= cMin) {
        throw new BadRequestException(`operatingHours.${day}: open must be before close (${open} / ${close})`);
      }
      out[day]!.push({ open, close });
    }
  }
  return out as unknown as Prisma.InputJsonValue;
}
