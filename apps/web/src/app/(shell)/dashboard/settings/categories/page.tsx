'use client';

import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { cn } from '@/lib/cn';
import { StructuredObject } from '@/components/ui/structured-object';
import { listTenantCategories } from '@/lib/api/tenants-branches';
import { getStoredToken } from '@/lib/auth/storage';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

type CategoryRow = {
  id?: string;
  category?: string;
  enabled?: boolean;
  settings?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  FOOD_DINING: {
    label: 'Food & Dining',
    description: 'Floor rhythm, digital bills, and dining-native guest flows.',
    icon: 'ph:fork-knife-duotone',
  },
  BEAUTY_GROOMING: {
    label: 'Beauty & Grooming',
    description: 'Stations, services, and quiet assistance for treatment spaces.',
    icon: 'ph:flower-duotone',
  },
};

function formatStamp(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function settingsEntries(row: CategoryRow): [string, unknown][] {
  const s = row.settings;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return [];
  return Object.entries(s);
}

export default function CategoriesSettingsPage() {
  const { tenantId } = useScope();
  const [rows, setRows] = useState<CategoryRow[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      return;
    }
    listTenantCategories(token, tenantId)
      .then((raw) => setRows(Array.isArray(raw) ? (raw as CategoryRow[]) : []))
      .catch(() => {
        toast.error('Could not load categories');
        setRows([]);
      });
  }, [tenantId]);

  return (
    <div className="space-y-8">
      <SectionHeader
        tone="business"
        eyebrow="Catalog"
        title="Categories"
        description="Tenant category switches for Food & Dining and Beauty & Grooming. Structured settings render below as labeled fields instead of raw JSON."
      />
      {!tenantId ? (
        <p className="text-sm text-smoke-200">Select a tenant.</p>
      ) : (
        <SettingsSection
          title="Assignments"
          description={`${rows.length} record${rows.length === 1 ? '' : 's'} for this tenant.`}
        >
          {rows.length === 0 ? (
            <p className="text-sm text-smoke-200">No category rows — enable categories during tenant onboarding.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.slice(0, 12).map((row, i) => {
                const code = String(row.category ?? '');
                const meta = CATEGORY_META[code] ?? {
                  label: code ? code.replace(/_/g, ' ') : 'Category',
                  description: 'Tenant catalog entry.',
                  icon: 'ph:tag-duotone',
                };
                const kv = settingsEntries(row);

                return (
                  <div
                    key={row.id ?? `${code}-${i}`}
                    className="rounded-2xl border border-smoke-400/10 bg-ivory-50/90 p-5 shadow-soft transition-shadow duration-200 hover:border-smoke-400/14 hover:shadow-card"
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-smoke-400/[0.06] text-smoke-400">
                          <Icon icon={meta.icon} className="h-6 w-6" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-base font-semibold text-smoke-400">{meta.label}</h3>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                row.enabled
                                  ? 'bg-emerald-800/12 text-emerald-900'
                                  : 'bg-smoke-400/10 text-smoke-200',
                              )}
                            >
                              {row.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-smoke-200">{meta.description}</p>
                          {code ? (
                            <p className="mt-2 font-mono text-[11px] tracking-tight text-smoke-200/85">{code}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 border-t border-smoke-400/[0.06] pt-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Created</dt>
                        <dd className="mt-0.5 text-sm text-smoke-300">{formatStamp(row.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Updated</dt>
                        <dd className="mt-0.5 text-sm text-smoke-300">{formatStamp(row.updatedAt)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 border-t border-smoke-400/[0.06] pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Settings</p>
                      {kv.length === 0 ? (
                        <p className="mt-2 text-sm text-smoke-200">Defaults — no structured overrides on this row.</p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {kv.map(([k, val]) => (
                            <li
                              key={k}
                              className="rounded-xl border border-smoke-400/[0.06] bg-ivory-100/50 px-3 py-2.5"
                            >
                              <p className="font-mono text-[11px] text-smoke-200">{k}</p>
                              <div className="mt-2">
                                {typeof val === 'object' && val !== null ? (
                                  <StructuredObject value={val} />
                                ) : (
                                  <p className="break-words text-sm font-medium leading-snug text-smoke-400">
                                    {String(val)}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsSection>
      )}
    </div>
  );
}
