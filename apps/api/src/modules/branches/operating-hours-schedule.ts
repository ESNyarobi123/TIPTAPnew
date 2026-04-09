import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) {
    return -1;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

const LONG_WEEKDAY_TO_KEY: Record<string, string> = {
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
  Sunday: 'sun',
};

/**
 * Local weekday + minutes since midnight for `at` in IANA `timeZone` (defaults to UTC).
 */
function localDayKeyAndMinutes(at: Date, timeZone: string): { dayKey: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const dayKey = LONG_WEEKDAY_TO_KEY[wd ?? ''];
  if (!dayKey) {
    throw new BadRequestException('Could not resolve local weekday for scheduled time');
  }
  const minutes = Number.parseInt(hour ?? '0', 10) * 60 + Number.parseInt(minute ?? '0', 10);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
    throw new BadRequestException('Could not resolve local time for scheduledAt');
  }
  return { dayKey, minutes };
}

/**
 * When `operatingHours` is set (non-empty), ensures `at` falls inside at least one interval
 * for that local day in `timezone`. If `operatingHours` is null or `{}`, does nothing.
 */
export function assertScheduledAtFitsBranchOperatingHours(
  at: Date,
  operatingHours: Prisma.JsonValue | null | undefined,
  timezone: string | null | undefined,
): void {
  if (!operatingHours || typeof operatingHours !== 'object' || Array.isArray(operatingHours)) {
    return;
  }
  const oh = operatingHours as Record<string, unknown>;
  if (Object.keys(oh).length === 0) {
    return;
  }

  const tz = timezone?.trim() || 'UTC';
  let local: { dayKey: string; minutes: number };
  try {
    local = localDayKeyAndMinutes(at, tz);
  } catch (e) {
    if (e instanceof RangeError) {
      throw new BadRequestException(`Invalid branch timezone for scheduling: ${tz}`);
    }
    throw e;
  }

  const intervals = oh[local.dayKey];
  if (!intervals || !Array.isArray(intervals) || intervals.length === 0) {
    throw new BadRequestException(
      `scheduledAt falls on a day when this branch is closed (${local.dayKey}, ${tz})`,
    );
  }

  for (const iv of intervals) {
    if (typeof iv !== 'object' || iv === null || Array.isArray(iv)) {
      continue;
    }
    const row = iv as Record<string, unknown>;
    if (typeof row.open !== 'string' || typeof row.close !== 'string') {
      continue;
    }
    const oMin = toMinutes(row.open);
    const cMin = toMinutes(row.close);
    if (oMin < 0 || cMin < 0 || oMin >= cMin) {
      continue;
    }
    if (local.minutes >= oMin && local.minutes < cMin) {
      return;
    }
  }

  throw new BadRequestException(`scheduledAt is outside branch published hours (${tz})`);
}
