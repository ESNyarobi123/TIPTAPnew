'use client';

import { Icon } from '@iconify/react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

async function copyText(text: string, onDone: (label: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    onDone('Copied');
  } catch {
    onDone('Copy failed');
  }
}

function WhatsappLaunchPageInner() {
  const searchParams = useSearchParams();
  const [copyStatus, setCopyStatus] = useState('Copy handoff text');
  const [launched, setLaunched] = useState(false);

  const handoffText = searchParams.get('text') ?? '';
  const publicRef = searchParams.get('ref') ?? '';
  const target = searchParams.get('target') ?? '';
  const scope = searchParams.get('scope') ?? '';
  const type = searchParams.get('type') ?? '';

  const whatsappLink = useMemo(() => {
    const digits = (process.env.NEXT_PUBLIC_TIPTAP_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
    if (!digits || !handoffText) {
      return null;
    }
    return `https://wa.me/${digits}?text=${encodeURIComponent(handoffText)}`;
  }, [handoffText]);

  useEffect(() => {
    if (!whatsappLink || launched) {
      return;
    }
    setLaunched(true);
    const t = window.setTimeout(() => {
      window.location.replace(whatsappLink);
    }, 450);
    return () => window.clearTimeout(t);
  }, [launched, whatsappLink]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.22),_transparent_38%),linear-gradient(180deg,_#f7f5ef_0%,_#efe9db_100%)] text-smoke-400">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-14 sm:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <section className="rounded-[32px] border border-smoke-400/10 bg-ivory-50/92 p-8 shadow-card backdrop-blur-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-smoke-200">TIPTAP handoff</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Opening WhatsApp
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-smoke-200">
              Your service flow is ready. If WhatsApp does not open automatically, use the button below or copy the handoff text and send it manually.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {publicRef ? (
                <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/80 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Public ref</p>
                  <p className="mt-2 font-mono text-lg font-semibold text-smoke-400">{publicRef}</p>
                </div>
              ) : null}
              {type ? (
                <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/80 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Entry type</p>
                  <p className="mt-2 text-sm font-medium text-smoke-400">{type.replace(/_/g, ' ')}</p>
                </div>
              ) : null}
              {target ? (
                <div className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-100/80 px-4 py-3 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-smoke-200">Target</p>
                  <p className="mt-2 text-sm font-medium text-smoke-400">{target}</p>
                  {scope ? <p className="mt-1 text-xs text-smoke-200">{scope}</p> : null}
                </div>
              ) : null}
            </div>

            <div className="mt-8 rounded-[28px] border border-smoke-400/[0.06] bg-smoke-900 p-5 text-ivory-100 shadow-soft">
              <div className="flex items-center gap-2">
                <Icon icon="logos:whatsapp-icon" className="h-5 w-5" aria-hidden />
                <p className="text-sm font-semibold">Handoff text</p>
              </div>
              <pre className="mt-4 overflow-auto whitespace-pre-wrap font-mono text-sm">
                {handoffText || 'Missing handoff text'}
              </pre>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {whatsappLink ? (
                <Button type="button" onClick={() => window.location.replace(whatsappLink)}>
                  Open WhatsApp
                </Button>
              ) : null}
              {handoffText ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void copyText(handoffText, (label) => {
                      setCopyStatus(label);
                      window.setTimeout(() => setCopyStatus('Copy handoff text'), 1800);
                    })
                  }
                >
                  {copyStatus}
                </Button>
              ) : null}
            </div>
          </section>

          <aside className="rounded-[32px] border border-smoke-400/10 bg-white/70 p-8 shadow-soft backdrop-blur-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-smoke-200">What happens next</p>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed text-smoke-300">
              <li className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-50/85 px-4 py-3">
                TIPTAP passes the secure entry text into the business WhatsApp line.
              </li>
              <li className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-50/85 px-4 py-3">
                WhatsApp opens with the correct branch, staff, table, or station context ready to continue.
              </li>
              <li className="rounded-2xl border border-smoke-400/[0.06] bg-ivory-50/85 px-4 py-3">
                The guest enters the guided menu, requests help, pays, rates, or tips from the same conversation flow.
              </li>
            </ol>

            {!whatsappLink ? (
              <p className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-900">
                Configure <span className="font-mono">NEXT_PUBLIC_TIPTAP_WHATSAPP_NUMBER</span> so this page can open the right WhatsApp line automatically.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function WhatsappLaunchPage() {
  // Next.js requires useSearchParams() usage to be under a Suspense boundary.
  return (
    <Suspense fallback={<main className="min-h-screen bg-ivory-50 p-8 text-smoke-300">Loading…</main>}>
      <WhatsappLaunchPageInner />
    </Suspense>
  );
}
