import Link from 'next/link';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-ivory-100/14 bg-ivory-100/[0.97] shadow-[0_24px_80px_-36px_rgba(0,0,0,0.55)] ring-1 ring-ivory-100/22 backdrop-blur-sm">
        <CardHeader className="border-b border-smoke-400/[0.06] bg-[linear-gradient(180deg,rgba(255,253,248,0.95),rgba(244,239,229,0.75))]">
          <CardTitle className="flex items-center gap-3 text-[1.35rem]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-smoke-400/[0.06] text-smoke-400 ring-1 ring-smoke-400/[0.05]">
              <Icon icon="ph:key-duotone" className="h-6 w-6" aria-hidden />
            </span>
            Reset password
          </CardTitle>
          <p className="text-sm leading-relaxed text-smoke-200">
            Self-service password reset is not wired into the API yet, so this flow stays honest and simple for now.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[1.35rem] border border-smoke-400/[0.08] bg-ivory-50/90 p-4 text-sm leading-relaxed text-smoke-300">
            Contact your administrator or support channel to recover access, then come back here to sign in normally.
          </div>
          <Button asChild variant="secondary" className="w-full shadow-soft">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
