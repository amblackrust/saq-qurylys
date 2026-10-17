import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * Status chip on a semantic tinted background. `green | yellow | red | none` are the zone tones (zones only!),
 * `default` is the pink brand tone, `secondary` the neutral one.
 */
const badgeVariants = cva(
  'inline-flex min-h-7 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded border border-transparent px-2 text-[13px] font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary/16 text-accent-text',
        secondary: 'bg-zone-none-bg text-zone-none-ink',
        outline: 'border-border-strong text-text-2',
        destructive: 'bg-zone-red-bg text-zone-red-ink',
        green: 'bg-zone-green-bg text-zone-green-ink',
        yellow: 'bg-zone-yellow-bg text-zone-yellow-ink',
        red: 'bg-zone-red-bg text-zone-red-ink',
        none: 'bg-zone-none-bg text-zone-none-ink',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';
  return <Comp data-slot="badge" data-variant={variant ?? 'secondary'} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
