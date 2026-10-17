import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded text-sm font-medium whitespace-nowrap text-text-2 outline-none transition-colors duration-(--dur) hover:bg-hover hover:text-text focus-visible:ring-1 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-zone-red data-[state=on]:bg-hover data-[state=on]:text-accent-text [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-border-strong bg-surface-sunken',
      },
      size: {
        sm: 'min-h-11 min-w-11 px-3',
        md: 'min-h-11 min-w-11 px-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

function Toggle({ className, variant, size, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, size }), className)} {...props} />;
}

export { Toggle, toggleVariants };
