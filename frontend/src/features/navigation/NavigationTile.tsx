import type { ReactNode, Ref } from 'react';
import { IconArrowLeft, IconArrowUpRight } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import type { NavigationEntry } from './model';

const MotionLink = motion.create(Link);

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

const bentoLayoutTransition = {
  layout: { type: 'tween' as const, duration: 0.68, ease: [0.83, 0, 0.17, 1] as const },
};

function navigationTone(item: NavigationEntry) {
  if (item.id === 'work') return 'work';
  if (item.id === 'adsQueue' || item.id === 'admin') return 'featured';
  return undefined;
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
  const secondaryHomeTile = mode === 'home' && item.id !== 'work' && item.id !== 'adsQueue';
  const tone = navigationTone(item);
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
      <span className={cn('min-w-0 flex-1', secondaryHomeTile && 'w-full flex-none')}>
        <span className={cn(
          'block min-w-0 break-words font-medium tracking-[-0.02em]',
          secondaryHomeTile ? 'text-2xl leading-tight' : mode === 'home' ? 'text-xl leading-tight sm:text-2xl lg:text-3xl' : 'text-sm leading-snug sm:text-base',
        )}>
          {item.label}
        </span>
        {mode === 'home' && <span className="mt-2 block max-w-[38ch] text-sm leading-relaxed opacity-80">{item.purpose}</span>}
      </span>
      {mode === 'home' && (
        <IconArrowUpRight
          className={cn(
            'bento-navigation__arrow mt-1 size-5 shrink-0 opacity-70 transition-transform duration-150 motion-reduce:transition-none',
            secondaryHomeTile && 'absolute top-5 right-5 mt-0 sm:top-6 sm:right-6 lg:top-7 lg:right-7',
          )}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <motion.article
      layout
      layoutDependency={`${mode}:${current}:${expanded}`}
      layoutId={`bento-card-${item.id}`}
      transition={bentoLayoutTransition}
      id={isExpanded ? 'bento-section-panel' : undefined}
      data-testid={isExpanded ? 'bento-section-panel' : undefined}
      data-current={current ? 'true' : undefined}
      data-expanded={isExpanded ? 'true' : undefined}
      aria-label={current ? item.label : undefined}
      aria-current={current ? (expanded ? 'location' : 'page') : undefined}
      className={cn(
        'group min-w-0 rounded-[clamp(1.1rem,1.8vw,1.7rem)] border border-border shadow-1',
        isExpanded ? 'overflow-clip' : 'overflow-hidden',
        'bg-surface-raised text-text',
        current && 'border-primary/45 shadow-2',
        mode === 'home' && 'min-h-40 sm:min-h-48 lg:min-h-52',
        mode === 'compact' && 'min-h-[5.5rem] sm:min-h-24',
        isExpanded && 'col-span-12',
        className,
      )}
      style={{ borderRadius: 'clamp(1.1rem, 1.8vw, 1.7rem)' }}
    >
      <MotionLink
        layout
        layoutDependency={`${mode}:${current}:${expanded}`}
        transition={bentoLayoutTransition}
        ref={focusRef}
        to={isExpanded ? returnTo : item.to}
        data-testid={testId}
        data-nav-tone={tone}
        aria-current={current && !isExpanded ? (expanded ? 'location' : 'page') : undefined}
        aria-expanded={expanded ? true : undefined}
        aria-controls={expanded ? 'bento-leaf-navigation' : undefined}
        className={cn(
          'bento-navigation__link flex min-w-0 items-start gap-3 text-inherit no-underline outline-none transition-[background-color,color,transform] duration-150 ease-out active:scale-[.99] motion-reduce:transform-none motion-reduce:transition-none',
          !isExpanded && 'bg-surface-raised text-text',
          'focus-visible:z-10 focus-visible:rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
          mode === 'home' && 'h-full min-h-40 p-5 sm:min-h-48 sm:p-6 lg:min-h-52 lg:p-7',
          secondaryHomeTile && 'relative flex-col',
          mode === 'compact' && 'h-full min-h-[5.5rem] items-center p-3 sm:min-h-24 sm:p-3.5',
          isExpanded && 'min-h-11 items-center px-5 py-3 sm:px-6',
        )}
      >
        {tileContents}
      </MotionLink>
      {isExpanded && children && (
        <motion.div
          layout
          layoutDependency={`${mode}:${current}:${expanded}`}
          transition={bentoLayoutTransition}
          className="min-w-0 border-t border-border bg-bg px-4 py-4 text-text sm:px-6 sm:py-6"
        >
          {children}
        </motion.div>
      )}
    </motion.article>
  );
}
