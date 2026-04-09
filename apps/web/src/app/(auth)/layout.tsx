import { Icon } from '@iconify/react';
import Link from 'next/link';

const authHighlights = [
  {
    icon: 'fluent-color:apps-list-detail-32',
    title: 'Role-safe access',
    body: 'Right role. Right workspace.',
  },
  {
    icon: 'fluent-color:chat-48',
    title: 'Guest-facing flow',
    body: 'QR and WhatsApp stay linked.',
  },
  {
    icon: 'fluent-color:coin-multiple-48',
    title: 'Clean finance',
    body: 'Each merchant keeps separate rails.',
  },
];

const authStats = [
  ['Multi-role', 'Workspaces'],
  ['QR entry', 'WhatsApp'],
  ['One system', 'Many businesses'],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f0e4] text-smoke-400">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_30%),radial-gradient(circle_at_90%_0%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_10%_100%,rgba(59,130,246,0.08),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(40,36,39,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(40,36,39,0.045)_1px,transparent_1px)] [background-size:84px_84px]" />

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
        <section className="hidden border-r border-smoke-400/[0.07] lg:flex">
          <div className="flex w-full flex-col justify-between p-10 xl:p-14">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="group flex items-center gap-3 font-display text-lg font-semibold tracking-tight text-smoke-400">
                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-smoke-400 text-sm text-ivory-100 shadow-soft transition group-hover:bg-smoke-300">
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(238,235,217,0.24),transparent_60%)]" />
                  <span className="relative">T</span>
                </span>
                TIPTAP
              </Link>
              <Link
                href="/"
                className="rounded-full border border-smoke-400/[0.08] bg-ivory-50/90 px-4 py-2 text-sm font-medium text-smoke-300 transition hover:border-smoke-400/12 hover:text-smoke-400"
              >
                Back home
              </Link>
            </div>

            <div className="max-w-2xl space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-700/12 bg-amber-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                  Auth v2
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-balance xl:text-[4.2rem]">
                    Clean entry into TIPTAP.
                  </h1>
                  <p className="max-w-lg text-[15px] text-smoke-200">Simple sign-in. Clear routing. Calm onboarding.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {authStats.map(([label, value]) => (
                  <div key={label} className="rounded-[1.4rem] border border-smoke-400/[0.08] bg-ivory-50/88 p-4 shadow-soft">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke-200">{label}</p>
                    <p className="mt-2 font-display text-lg font-semibold text-smoke-400">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {authHighlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.55rem] border border-smoke-400/[0.08] bg-ivory-50/84 p-5 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)]"
                  >
                    <Icon icon={item.icon} className="h-9 w-9" aria-hidden />
                    <p className="mt-4 font-display text-lg font-semibold text-smoke-400">{item.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-smoke-200">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-smoke-400/[0.08] bg-gradient-to-br from-smoke-400 to-[#2c292f] p-6 text-ivory-100 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.75)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivory-200/65">
                    Workspace routing
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">One account. Right destination.</p>
                </div>
                <Icon icon="fluent-color:apps-48" className="h-12 w-12 shrink-0" aria-hidden />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/60">Manager</p>
                  <p className="mt-1 text-sm text-ivory-100">Control room</p>
                </div>
                <div className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/60">Staff</p>
                  <p className="mt-1 text-sm text-ivory-100">Personal desk</p>
                </div>
                <div className="rounded-2xl border border-ivory-100/[0.08] bg-ivory-100/[0.06] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-200/60">Admin</p>
                  <p className="mt-1 text-sm text-ivory-100">Platform command</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <div className="mb-6 flex w-full max-w-[31rem] items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-smoke-400">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-smoke-400 text-sm text-ivory-100 shadow-soft">
                T
              </span>
              TIPTAP
            </Link>
            <Link href="/" className="rounded-full border border-smoke-400/[0.08] bg-ivory-50/90 px-4 py-2 text-sm font-medium text-smoke-300">
              Home
            </Link>
          </div>

          <div className="w-full max-w-[31rem]">{children}</div>
        </section>
      </div>
    </div>
  );
}
