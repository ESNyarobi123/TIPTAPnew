import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
} from 'react';
import { cn } from '@/lib/cn';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  /** Merge styles into a single child element (e.g. Next.js `Link`). */
  asChild?: boolean;
};

const variants = (
  variant: ButtonProps['variant'],
  size: ButtonProps['size'],
  className?: string,
) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smoke-400/30 disabled:pointer-events-none disabled:opacity-45',
    variant === 'primary' &&
      'bg-smoke-400 text-ivory-100 shadow-soft hover:bg-smoke-300 hover:shadow-card',
    variant === 'secondary' &&
      'bg-ivory-50 text-smoke-400 shadow-soft ring-1 ring-smoke-400/10 hover:bg-ivory-200/80 hover:shadow-card',
    variant === 'outline' &&
      'border border-smoke-400/20 bg-transparent text-smoke-400 hover:border-smoke-400/40 hover:bg-smoke-400/[0.04]',
    variant === 'ghost' && 'text-smoke-300 hover:bg-smoke-400/[0.06]',
    size === 'sm' && 'h-9 px-3.5 text-sm',
    size === 'md' && 'h-11 px-5 text-sm',
    size === 'lg' && 'h-12 px-7 text-base',
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild, children, ...props }, ref) => {
    const cls = variants(variant, size, className);
    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string; ref?: unknown }>;
      return cloneElement(child, {
        className: cn(child.props.className, cls),
        ref,
      });
    }
    return (
      <button ref={ref} className={cls} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
