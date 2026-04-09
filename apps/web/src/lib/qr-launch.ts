'use client';

import type { QrMutationResult, QrRecord } from '@/lib/api/qr';
import { renderQrSvg } from '@/lib/qr';

const QR_LAUNCH_CACHE_KEY = 'tiptap:qr-launch-cache:v1';

type CachedQrLaunchMap = Record<string, QrMutationResult>;

export function formatQrScope(row: Pick<QrRecord, 'branch'>): string {
  if (row.branch) {
    return `${row.branch.name} (${row.branch.code})`;
  }
  return 'Tenant-wide';
}

export function formatQrTarget(row: Pick<QrRecord, 'type' | 'linkedTarget'>): string {
  if (!row.linkedTarget) {
    return row.type.replaceAll('_', ' ');
  }
  switch (row.linkedTarget.kind) {
    case 'STAFF':
      return row.linkedTarget.label;
    case 'TABLE':
      return `${row.linkedTarget.code}${row.linkedTarget.label ? ` · ${row.linkedTarget.label}` : ''}`;
    case 'STATION':
      return `${row.linkedTarget.code}${row.linkedTarget.label ? ` · ${row.linkedTarget.label}` : ''}`;
    case 'BUSINESS':
    default:
      return row.linkedTarget.label ?? row.type.replaceAll('_', ' ');
  }
}

export function whatsappDeepLink(prefillText: string): string | null {
  const rawNumber = process.env.NEXT_PUBLIC_TIPTAP_WHATSAPP_NUMBER ?? '';
  const digits = rawNumber.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefillText)}`;
}

export function buildLaunchPageUrl(origin: string, record: QrMutationResult): string | null {
  const prefillText = record.customerLaunch?.prefillText;
  if (!origin || !prefillText) {
    return null;
  }
  const params = new URLSearchParams({
    text: prefillText,
    ref: record.publicRef,
    target: formatQrTarget(record),
    scope: formatQrScope(record),
    type: record.type,
  });
  return `${origin}/launch/whatsapp?${params.toString()}`;
}

function readCache(): CachedQrLaunchMap {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(QR_LAUNCH_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as CachedQrLaunchMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CachedQrLaunchMap) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(QR_LAUNCH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures; the live launch pack still works for the current render.
  }
}

export function readCachedQrLaunchPack(qrId: string): QrMutationResult | null {
  return readCache()[qrId] ?? null;
}

export function listCachedQrLaunchPacks(): CachedQrLaunchMap {
  return readCache();
}

export function cacheQrLaunchPack(record: QrMutationResult) {
  const cache = readCache();
  cache[record.id] = record;
  writeCache(cache);
}

export async function copyTextToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true as const, message: `${label} copied` };
  } catch {
    return { ok: false as const, message: `Could not copy ${label.toLowerCase()}` };
  }
}

export async function downloadQrSvgAsset(value: string, filename: string) {
  const svg = await renderQrSvg(value, {
    size: 720,
    margin: 1,
    foreground: '#111827',
    background: '#FFFFFFFF',
  });
  if (!svg || typeof window === 'undefined') {
    throw new Error('QR preview unavailable');
  }
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
