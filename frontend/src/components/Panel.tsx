import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title?: ReactNode;
  /** right side of the title row */
  actions?: ReactNode;
  children: ReactNode;
  /** remove inner padding (tables, maps) */
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

/** Shared content surface with an optional heading and actions. */
export function Panel({ title, actions, children, flush, className, style, id }: Props) {
  return (
    <section id={id} className={cn('min-w-0 rounded-2xl border border-border bg-surface shadow-1', className)} style={style}>
      {(title || actions) && (
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          {title && <h3 className="text-base font-semibold tracking-tight text-text">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
