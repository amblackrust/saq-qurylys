import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-transparent text-sm font-medium whitespace-nowrap outline-none select-none transition-[color,background-color,border-color,box-shadow] duration-(--dur) focus-visible:ring-1 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-zone-red [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** pink, the main action */
        default: 'bg-primary text-primary-foreground hover:bg-accent-hover hover:shadow-glow',
        secondary:
          'border-border-strong bg-surface-sunken text-text hover:bg-surface-raised active:bg-pressed aria-expanded:bg-surface-raised',
        outline: 'border-border-strong text-text-2 hover:bg-hover hover:text-text active:bg-pressed aria-expanded:bg-hover',
        ghost: 'text-text-2 hover:bg-hover hover:text-text active:bg-pressed aria-expanded:bg-hover aria-expanded:text-text',
        /** red zone color: irreversible actions */
        destructive: 'bg-zone-red text-zone-red-action-ink hover:brightness-95 focus-visible:ring-text',
        link: 'h-auto rounded-none px-0 text-link underline-offset-4 hover:underline',
      },
      size: {
        xs: "min-h-11 gap-1.5 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        sm: "min-h-11 gap-1.5 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        md: 'min-h-11 px-4',
        icon: 'size-11',
        'icon-sm': 'size-11',
        'icon-xs': 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** shows a spinner in front of the label and disables the button (use while a mutation is pending) */
  loading?: boolean;
}

function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant ?? 'default'}
        data-size={size ?? 'md'}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type="button"
      data-slot="button"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'md'}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
