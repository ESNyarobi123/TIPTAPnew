'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsSection } from '@/components/ui/settings-section';
import { StatusChip } from '@/components/ui/status-chip';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { getTenantLanding, upsertTenantLanding } from '@/lib/api/tenant-landing';
import { getStoredToken } from '@/lib/auth/storage';
import {
  LANDING_THEME_PRESETS,
  linesToList,
  listToLines,
  normalizeLandingTheme,
  type LandingThemePreset,
} from '@/lib/tenant-landing-theme';
import { toast } from '@/lib/toast';
import { useScope } from '@/providers/scope-provider';

function slugify(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

/** Short random public path segment (multi-tenant safe uniqueness on save). */
function randomLandingSlug() {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `p-${hex}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export default function LandingBuilderPage() {
  const { tenantId } = useScope();
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<any>(null);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaText, setCtaText] = useState('Chat on WhatsApp');
  const [ctaHref, setCtaHref] = useState('');
  const [heroLabel, setHeroLabel] = useState('Now serving');
  const [about, setAbout] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [servicesText, setServicesText] = useState('');
  const [themePreset, setThemePreset] = useState<LandingThemePreset>('ledger');

  const theme = LANDING_THEME_PRESETS[themePreset];
  const publicPath = useMemo(() => (slug ? `/t/${slug}` : null), [slug]);
  const publicUrl = useMemo(
    () => (origin && publicPath ? `${origin}${publicPath}` : publicPath),
    [origin, publicPath],
  );
  const highlights = useMemo(() => linesToList(highlightsText), [highlightsText]);
  const services = useMemo(() => linesToList(servicesText), [servicesText]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getTenantLanding(token, tenantId)
      .then((payload) => {
        setDraft(payload);
        setSlug(typeof payload.slug === 'string' ? payload.slug : '');
        setTitle(typeof payload.title === 'string' ? payload.title : '');
        setSubtitle(typeof payload.subtitle === 'string' ? payload.subtitle : '');
        setCtaText(typeof payload.heroCtaText === 'string' && payload.heroCtaText ? payload.heroCtaText : 'Chat on WhatsApp');
        setCtaHref(typeof payload.heroCtaHref === 'string' ? payload.heroCtaHref : '');

        const sections = isRecord(payload.sections) ? payload.sections : {};
        setHeroLabel(typeof sections.heroLabel === 'string' && sections.heroLabel ? sections.heroLabel : 'Now serving');
        setAbout(typeof sections.about === 'string' ? sections.about : '');
        setHighlightsText(listToLines(sections.highlights));
        setServicesText(listToLines(sections.services));

        const nextTheme = normalizeLandingTheme(payload.theme);
        setThemePreset(nextTheme.preset);
      })
      .catch((error) => toast.error(error instanceof ApiError ? error.message : 'Failed to load landing draft'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function save(publish?: boolean) {
    const token = getStoredToken();
    if (!token || !tenantId) return;
    setPending(true);
    try {
      const nextSlug = slugify(slug);
      const next = await upsertTenantLanding(token, tenantId, {
        slug: nextSlug,
        title: title || null,
        subtitle: subtitle || null,
        heroCtaText: ctaText || null,
        heroCtaHref: ctaHref || null,
        theme: {
          preset: theme.preset,
        },
        sections: {
          heroLabel: heroLabel || null,
          about: about || null,
          highlights,
          services,
        },
        ...(publish === undefined ? {} : { isPublished: publish }),
      });
      setDraft(next);
      setSlug(next.slug);
      toast.success(publish ? 'Landing published' : 'Draft saved');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  if (!tenantId && !loading) {
    return (
      <EmptyState
        variant="premium"
        icon="ph:buildings-duotone"
        title="Select a tenant"
        description="Choose an organization in the header to build its public landing page."
      />
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <SectionHeader
        tone="business"
        eyebrow="Brand surface"
        title="Landing page builder"
        description="Publish a public page at /t/{your-slug}. When Food & Dining or Beauty & Grooming are enabled for this business, the live page automatically lists active catalog items—including photos and prices from services you uploaded in those modules. Manual “featured services” lines below are a fallback when no catalog is available."
      />

      <SettingsSection
        title="Theme and structure"
        description="Choose a clear visual direction first, then fit the business message into a few strong sections."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-smoke-400/10 shadow-soft">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-3">
                <Label>Theme preset</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  {Object.values(LANDING_THEME_PRESETS).map((preset) => {
                    const selected = preset.preset === themePreset;
                    return (
                      <button
                        key={preset.preset}
                        type="button"
                        onClick={() => setThemePreset(preset.preset)}
                        className="rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
                        style={{
                          borderColor: selected ? preset.accent : preset.border,
                          background: `linear-gradient(180deg, ${preset.panel}, ${preset.card})`,
                          boxShadow: selected ? `0 0 0 1px ${preset.accent}` : undefined,
                        }}
                      >
                        <div className="flex gap-2">
                          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: preset.accent }} />
                          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: preset.accentSoft }} />
                        </div>
                        <p className="mt-3 text-sm font-semibold" style={{ color: preset.ink }}>
                          {preset.label}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed" style={{ color: preset.muted }}>
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <Label htmlFor="lp-slug">Public slug</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSlug(randomLandingSlug())}
                  >
                    Random slug
                  </Button>
                </div>
                <Input id="lp-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="e.g. tiptap-cafe or p-abc123…" />
                <p className="text-xs text-smoke-200">
                  The URL is <span className="font-mono">/t/{slugify(slug) || 'your-slug'}</span>. Use a random slug for a hard-to-guess link; save & publish to apply.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lp-title">Title</Label>
                  <Input id="lp-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Business name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-hero-label">Hero label</Label>
                  <Input id="lp-hero-label" value={heroLabel} onChange={(event) => setHeroLabel(event.target.value)} placeholder="Now serving" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lp-sub">Subtitle</Label>
                <Input id="lp-sub" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Short value statement" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lp-about">About</Label>
                <Textarea id="lp-about" value={about} onChange={(event) => setAbout(event.target.value)} placeholder="A short paragraph about your business…" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lp-highlights">Highlights</Label>
                  <Textarea
                    id="lp-highlights"
                    value={highlightsText}
                    onChange={(event) => setHighlightsText(event.target.value)}
                    placeholder={'Walk-ins welcome\nWhatsApp ordering\nQuick service'}
                  />
                  <p className="text-xs text-smoke-200">One point per line. These render as quick trust chips.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-services">Featured services</Label>
                  <Textarea
                    id="lp-services"
                    value={servicesText}
                    onChange={(event) => setServicesText(event.target.value)}
                    placeholder={'Seafood platters\nTable service\nPrivate events'}
                  />
                  <p className="text-xs text-smoke-200">One service or menu line per row.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lp-cta-text">CTA text</Label>
                  <Input id="lp-cta-text" value={ctaText} onChange={(event) => setCtaText(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp-cta-href">CTA link</Label>
                  <Input id="lp-cta-href" value={ctaHref} onChange={(event) => setCtaHref(event.target.value)} placeholder="https://wa.me/…" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" disabled={pending || loading} onClick={() => void save(false)}>
                  Save draft
                </Button>
                <Button type="button" disabled={pending || loading} onClick={() => void save(true)} className="shadow-soft">
                  Publish
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-smoke-400/10 shadow-soft">
            <CardHeader className="border-b border-smoke-400/[0.06]">
              <CardTitle className="text-base">Live preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div
                className="p-5 sm:p-6"
                style={{
                  background: `radial-gradient(circle at top left, ${theme.glow}, transparent 40%), linear-gradient(180deg, ${theme.surface}, ${theme.card})`,
                  color: theme.ink,
                }}
              >
                <div
                  className="rounded-[1.75rem] border p-6 shadow-[0_18px_60px_-32px_rgba(15,23,42,0.45)]"
                  style={{
                    backgroundColor: theme.panel,
                    borderColor: theme.border,
                  }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.muted }}>
                    {heroLabel || 'Now serving'}
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">{title || 'Business name'}</h2>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.muted }}>
                    {subtitle || 'Short value statement goes here.'}
                  </p>

                  {highlights.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {highlights.map((item) => (
                        <span
                          key={item}
                          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]"
                          style={{ backgroundColor: theme.chipBg, color: theme.chipText }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-6 max-w-2xl text-sm leading-relaxed" style={{ color: theme.muted }}>
                    {about || 'Add a short description so new visitors understand what makes this business worth trusting.'}
                  </div>

                  <p className="mt-2 text-[10px] leading-relaxed" style={{ color: theme.muted }}>
                    On the real public URL, items from your Beauty / Food catalog replace this list when published (with photos).
                  </p>
                  <div className="mt-6 grid gap-3">
                    {(services.length ? services : ['Featured service one', 'Featured service two', 'Featured service three']).map((service) => (
                      <div
                        key={service}
                        className="rounded-2xl border px-4 py-3 text-sm font-medium"
                        style={{ borderColor: theme.border, backgroundColor: theme.surface }}
                      >
                        {service}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <span
                      className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-soft"
                      style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                    >
                      {ctaText || 'Chat on WhatsApp'}
                    </span>
                    <span
                      className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium"
                      style={{ borderColor: theme.border, color: theme.ink }}
                    >
                      View services
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Status and public URL"
        description="Draft privately, then publish when the page is ready for customers."
      >
        <Card className="border-smoke-400/10 shadow-soft">
          <CardHeader className="border-b border-smoke-400/[0.06]">
            <CardTitle className="text-base">Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {draft?.isPublished ? <StatusChip status="PUBLISHED" /> : <StatusChip status="DRAFT" />}
              {publicPath ? (
                <Link href={publicPath} target="_blank" className="text-sm font-medium text-smoke-400 hover:underline">
                  Preview public page
                </Link>
              ) : null}
            </div>
            <div className="rounded-2xl border border-smoke-400/10 bg-ivory-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-smoke-200">Public URL</p>
              <p className="mt-2 break-all font-mono text-sm text-smoke-300">{publicUrl ?? 'Save a slug to generate a URL.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending || loading} onClick={() => void save(false)}>
                Save draft
              </Button>
              <Button type="button" disabled={pending || loading} onClick={() => void save(true)} className="shadow-soft">
                Publish
              </Button>
              {publicUrl ? (
                <Button type="button" variant="outline" disabled={pending} onClick={() => void copyText(publicUrl, 'Public URL')}>
                  Copy URL
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </SettingsSection>
    </div>
  );
}
