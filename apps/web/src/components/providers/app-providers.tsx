'use client';

import { Toaster } from 'sonner';

/**
 * Global client providers. Toasts use Sonner with TIPTAP ivory/smoke styling.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        closeButton
        offset={16}
        gap={10}
        toastOptions={{
          classNames: {
            toast:
              'rounded-2xl border border-smoke-400/12 bg-ivory-50/95 !text-smoke-400 shadow-card backdrop-blur-md',
            title: '!text-sm !font-semibold !text-smoke-400',
            description: '!text-xs !font-normal !text-smoke-200',
            actionButton:
              '!rounded-xl !bg-smoke-400 !px-3 !py-1.5 !text-xs !font-medium !text-ivory-100',
            cancelButton: '!text-smoke-200',
            closeButton:
              '!rounded-lg !border-0 !bg-smoke-400/[0.06] !text-smoke-300 hover:!bg-smoke-400/10',
            success: '!border-l-[3px] !border-l-emerald-800',
            error: '!border-l-[3px] !border-l-rose-800',
            warning: '!border-l-[3px] !border-l-amber-800',
            info: '!border-l-[3px] !border-l-smoke-400',
          },
        }}
      />
    </>
  );
}
