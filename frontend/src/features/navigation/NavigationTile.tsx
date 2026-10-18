import type { ReactNode, Ref } from 'react';
import { IconArrowLeft, IconArrowUpRight } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import type { NavigationEntry } from './model';

export type NavigationTileMode = 'home' | 'compact' | 'expanded';

interface NavigationTileProps {
  item: NavigationEntry;
  mode: NavigationTileMode;
  current?: boolean;
  expanded?: boolean;
  returnTo?: string;
  returnLabel?: string;
  testId: string;
  focusRef?: Ref<HTMLAnchorElement>;
  children?: ReactNode;
  className?: string;
}

function toneClasses(item: NavigationEntry) {
  if (item.id === 'adsQueue' || item.id === 'admin') return 'bg-primary text-primary-foreground';
  if (item.id === 'explore') return 'bg-[#8ab7c1] text-[#181716]';
  if (item.id === 'tools' || item.id === 'objects') return 'bg-text text-bg';
  return 'bg-surface-raised text-text';
}

export function NavigationTile({
  item,
  mode,
  current = false,
  expanded = false,
  returnTo = '/home',
  returnLabel,
  testId,
  focusRef,
  children,
  className,
}: NavigationTileProps) {
  const isExpanded = mode === 'expanded';
  const tileContents = isExpanded ? (
    <>
      <IconArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{returnLabel}</span>
    </>
  ) : (
    <>
      <span className={cn('grid shrink-0 place-items-center', mode === 'home' ? 'size-10 [&_svg]:size-7' : 'size-8 [&_svg]:size-5')} aria-hidden="true">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block min-w-0 break-words font-medium tracking-[-0.02em]', mode === 'home' ? 'text-xl leading-tight sm:text-2xl lg:text-3xl' : 'text-sm leading-snug sm:text-base')}>
          {item.label}
        </span>
        {mode === 'home' && <span className="mt-2 block max-w-[38ch] text-sm leading-relaxed opacity-80">{item.purpose}</span>}
      </span>
      {mode === 'home' && <IconArrowUpRight className="mt-1 size-5 shrink-0 opacity-70 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transition-none" aria-hidden="true" />}
    </>
  );

  return (
    <motion.article
      layout
      layoutId={`bento-card-${item.id}`}
      transition={{ layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
      id={isExpanded ? 'bento-section-panel' : undefined}
      data-testid={isExpanded ? 'bento-section-panel' : undefined}
      aria-label={current ? item.label : undefined}
      aria-current={current ? (expanded ? 'location' : 'page') : undefined}
      className={cn(
        'group min-w-0 overflow-hidden rounded-[clamp(1.1rem,1.8vw,1.7rem)] border border-border shadow-1',
        'bg-surface text-text',
        mode === 'home' && 'min-h-40 sm:min-h-48 lg:min-h-52',
        mode === 'compact' && 'min-h-[5.5rem] sm:min-h-24 max-[360px]:min-h-28',
        isExpanded && 'col-span-12',
        className,
      )}
      style={{ borderRadius: 'clamp(1.1rem, 1.8vw, 1.7rem)' }}
    >
      <Link
        ref={focusRef}
        to={isExpanded ? returnTo : item.to}
        data-testid={testId}
        aria-current={current && !isExpanded ? (expanded ? 'location' : 'page') : undefined}
        aria-expanded={expanded ? true : undefined}
        aria-controls={expanded ? 'bento-leaf-navigation' : undefined}
        className={cn(
          'flex min-w-0 items-start gap-3 text-inherit no-underline outline-none transition-colors duration-200 motion-reduce:transition-none',
          !isExpanded && toneClasses(item),
          'focus-visible:z-10 focus-visible:rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
          mode === 'home' && 'h-full min-h-40 p-5 sm:min-h-48 sm:p-6 lg:min-h-52 lg:p-7',
          mode === 'compact' && 'h-full min-h-[5.5rem] items-center p-3 sm:min-h-24 sm:p-3.5 max-[360px]:min-h-28 max-[360px]:flex-col max-[360px]:items-start',
          isExpanded && 'min-h-11 items-center px-5 py-3 sm:px-6',
        )}
      >
        {tileContents}
      </Link>
      {isExpanded && children && <div className="border-t border-current/10 px-4 py-4 sm:px-6 sm:py-6">{children}</div>}
    </motion.article>
  );
}
