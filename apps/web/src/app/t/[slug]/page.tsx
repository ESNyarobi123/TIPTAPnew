import Link from 'next/link';
import { getTenantLandingPublic, type TenantLandingPublic } from '@/lib/api/tenant-landing';
import { formatMinorUnits } from '@/lib/format';
import { normalizeLandingTheme } from '@/lib/tenant-landing-theme';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolvePublicFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export default async function TenantPublicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data: TenantLandingPublic = await getTenantLandingPublic(slug);
  const theme = normalizeLandingTheme(data?.theme);
  const sections = isRecord(data?.sections) ? data.sections : {};
  const title =
    typeof data?.title === 'string' && data.title
      ? data.title
      : typeof data?.tenantName === 'string'
        ? data.tenantName
        : 'Business';
  const subtitle = typeof data?.subtitle === 'string' ? data.subtitle : null;
  const heroLabel = typeof sections.heroLabel === 'string' && sections.heroLabel ? sections.heroLabel : 'Now serving';
  const heroCtaText = typeof data?.heroCtaText === 'string' && data.heroCtaText ? data.heroCtaText : 'Chat on WhatsApp';
  const heroCtaHref = typeof data?.heroCtaHref === 'string' && data.heroCtaHref ? data.heroCtaHref : null;
  const about = typeof sections.about === 'string' ? sections.about : null;
  const highlightSource = Array.isArray(sections.highlights) ? (sections.highlights as unknown[]) : [];
  const serviceSource = Array.isArray(sections.services) ? (sections.services as unknown[]) : [];
  const highlights = Array.isArray(sections.highlights)
    ? highlightSource.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8)
    : [];
  const services = Array.isArray(sections.services)
    ? serviceSource.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8)
    : [];

  const catalogBeauty = data.catalog?.beautyServices ?? [];
  const catalogMenu = data.catalog?.menuItems ?? [];
  const hasCatalog = catalogBeauty.length > 0 || catalogMenu.length > 0;
  const serviceCards: string[] = services.length
    ? services
    : [
        'Order or book via WhatsApp',
        'Tips and ratings for your team',
        'Menus and services from this business',
      ];

  return (
    <main
      className="min-h-screen"
      style={{
        background: `radial-gradient(circle at top left, ${theme.glow}, transparent 42%), linear-gradient(180deg, ${theme.surface}, ${theme.card})`,
        color: theme.ink,
      }}
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div
          className="overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)]"
          style={{
            backgroundColor: theme.panel,
            borderColor: theme.border,
          }}
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
            <section className="p-8 sm:p-10 lg:p-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.muted }}>
                {heroLabel}
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
              {subtitle ? (
                <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: theme.muted }}>
                  {subtitle}
                </p>
              ) : null}

              {highlights.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {highlights.map((item: string) => (
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

              {about ? (
                <div className="mt-8 max-w-2xl text-sm leading-relaxed" style={{ color: theme.muted }}>
                  {about}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {heroCtaHref ? (
                  <Link
                    href={heroCtaHref}
                    className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-soft"
                    style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                  >
                    {heroCtaText}
                  </Link>
                ) : (
                  <span
                    className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-soft"
                    style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                  >
                    {heroCtaText}
                  </span>
                )}
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium"
                  style={{ borderColor: theme.border, color: theme.ink }}
                >
                  Powered by TIPTAP
                </Link>
              </div>
            </section>

            <aside
              className="max-h-[min(92vh,880px)] overflow-y-auto border-t p-8 sm:p-10 lg:border-l lg:border-t-0"
              style={{
                background: `linear-gradient(180deg, ${theme.card}, ${theme.surface})`,
                borderColor: theme.border,
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.muted }}>
                {hasCatalog ? 'Services from your catalog' : 'Featured services'}
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.muted }}>
                {hasCatalog
                  ? 'Photos, prices, and descriptions come from the services you configured (and uploaded) in the dashboard.'
                  : 'Short list curated in your landing editor. Enable Food or Beauty and add catalog items to show rich cards here.'}
              </p>

              <div className="mt-6 space-y-8">
                {catalogBeauty.length ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.muted }}>
                      Beauty & grooming
                    </p>
                    <div className="mt-3 grid gap-4">
                      {catalogBeauty.map((svc) => {
                        const img = resolvePublicFileUrl(svc.imageUrl);
                        const price =
                          svc.priceCents != null
                            ? formatMinorUnits(svc.priceCents, svc.currency ?? 'USD')
                            : null;
                        return (
                          <div
                            key={svc.id}
                            className="overflow-hidden rounded-2xl border text-left"
                            style={{ borderColor: theme.border, backgroundColor: theme.panel }}
                          >
                            <div className="aspect-[16/10] w-full bg-black/5">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div
                                  className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold opacity-30"
                                  style={{ color: theme.ink }}
                                >
                                  {svc.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.muted }}>
                                {svc.categoryName}
                              </p>
                              <p className="text-sm font-semibold leading-snug">{svc.name}</p>
                              {svc.description ? (
                                <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: theme.muted }}>
                                  {svc.description}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs" style={{ color: theme.muted }}>
                                {svc.durationMin != null ? <span>{svc.durationMin} min</span> : null}
                                {price ? <span className="font-semibold text-smoke-400">{price}</span> : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {catalogMenu.length ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.muted }}>
                      Food & dining
                    </p>
                    <div className="mt-3 grid gap-4">
                      {catalogMenu.map((item) => {
                        const img = resolvePublicFileUrl(item.imageUrl);
                        const price = formatMinorUnits(item.priceCents, item.currency);
                        return (
                          <div
                            key={item.id}
                            className="overflow-hidden rounded-2xl border text-left"
                            style={{ borderColor: theme.border, backgroundColor: theme.panel }}
                          >
                            <div className="aspect-[16/10] w-full bg-black/5">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div
                                  className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold opacity-30"
                                  style={{ color: theme.ink }}
                                >
                                  {item.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.muted }}>
                                {item.categoryName}
                              </p>
                              <p className="text-sm font-semibold leading-snug">{item.name}</p>
                              {item.description ? (
                                <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: theme.muted }}>
                                  {item.description}
                                </p>
                              ) : null}
                              <p className="pt-1 text-xs font-semibold text-smoke-400">{price}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {!hasCatalog ? (
                  <div className="grid gap-3">
                    {serviceCards.map((service: string) => (
                      <div
                        key={service}
                        className="rounded-2xl border px-4 py-3 text-sm font-medium"
                        style={{ borderColor: theme.border, backgroundColor: theme.panel }}
                      >
                        {service}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div
                className="mt-8 rounded-[1.5rem] border p-5"
                style={{ borderColor: theme.border, backgroundColor: theme.panel }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.muted }}>
                  Why customers use this page
                </p>
                <div className="mt-4 space-y-3 text-sm leading-relaxed" style={{ color: theme.muted }}>
                  <div>Open the business quickly from one clean link.</div>
                  <div>Jump to WhatsApp for the real service flow.</div>
                  <div>Browse real offerings with photos when the business has them in TIPTAP.</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
