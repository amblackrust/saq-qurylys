import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { LayoutGroup, MotionConfig, motion } from 'motion/react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useVisionEnabled } from '@/api/hooks/vision';
import { useAuth } from '@/auth/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingBlock } from '@/components/QueryState';
import { cn } from '@/lib/utils';
import { GlobalSearch } from '@/layout/GlobalSearch';
import { ActivityIsland } from '@/layout/ActivityIsland';
import { getNavigationGroup, getNavigationRoutes, matchNavigationGroupHub, matchNavigationRoute, createNavigationModel } from './model';
import { NavigationTile } from './NavigationTile';
import type { NavigationEntry, NavigationGroup, NavigationRoute } from './model';
import type { NavigationOutletContext } from './NavigationGroupPage';

interface BentoNavigationProps {
  headerUtilities: ReactNode;
  assistantOpen: boolean;
}

function homeGridClass(item: NavigationEntry, itemCount: number) {
  if (itemCount === 1) return 'col-span-12';
  if (item.id === 'work') return 'col-span-12 lg:col-span-7 lg:row-span-2';
  if (item.id === 'adsQueue' || item.id === 'signals') return 'col-span-12 sm:col-span-6 lg:col-span-5';
  return 'col-span-12 sm:col-span-6 lg:col-span-4';
}

const compactGridClass = 'col-span-6 sm:col-span-4 xl:col-span-2';
const bentoTransition = { layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const } };

export function BentoNavigation({ headerUtilities, assistantOpen }: BentoNavigationProps) {
  const { t } = useTranslation();
  const { canSeeRegistry, canEditRegistry, isAdmin } = useAuth();
  const location = useLocation();
  const navigationType = useNavigationType();
  const visionEnabled = useVisionEnabled();
  const headerRef = useRef<HTMLElement>(null);
  const sectionLinkRef = useRef<HTMLAnchorElement>(null);
  const previousNavigation = useRef<{ key: string; homeEntryId?: string }>({ key: '', homeEntryId: undefined });
  const entries = createNavigationModel({ canSeeRegistry, canEditRegistry, isAdmin, visionEnabled, t });
  const routes = getNavigationRoutes(entries);
  const route = matchNavigationRoute(routes, location.pathname, location.search);
  const groupHub = matchNavigationGroupHub(entries, location.pathname);
  const routeGroup = getNavigationGroup(entries, route?.groupId);
  const isHome = location.pathname === '/home' || location.pathname === '/home/';
  const showHomeGrid = isHome || (!groupHub && !route);
  const expandedRoot = groupHub ?? (route && !routeGroup ? route : undefined);
  const childRoute = routeGroup && !groupHub ? route : undefined;
  const childGroup = groupHub ?? routeGroup;
  const navigationKey = groupHub
    ? `group:${groupHub.id}`
    : routeGroup && route
      ? `${routeGroup.id}:${route.id}`
      : route
        ? `route:${route.id}`
        : 'home';
  const activeEntryId = groupHub?.id ?? routeGroup?.id ?? route?.id;

  useEffect(() => {
    const previous = previousNavigation.current;
    if (previous.key === navigationKey) return;
    const isFirstRender = previous.key === '';
    previousNavigation.current = { key: navigationKey, homeEntryId: activeEntryId };
    if (isFirstRender || location.hash || navigationType === 'POP') return;

    const frame = requestAnimationFrame(() => {
      const homeTile = navigationKey === 'home' && previous.homeEntryId
        ? document.querySelector<HTMLElement>(`[data-testid="bento-nav-card-${previous.homeEntryId}"]`)
        : null;
      const target = homeTile ?? sectionLinkRef.current ?? document.querySelector<HTMLElement>('[data-home-heading]');
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeEntryId, location.hash, navigationKey, navigationType]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    };
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    updateHeaderHeight();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-h');
    };
  }, []);

  const renderOutlet = (group?: NavigationGroup) => (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<LoadingBlock />}>
        <motion.div
          key={navigationKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet context={{ entries, group } satisfies NavigationOutletContext} />
        </motion.div>
      </Suspense>
    </ErrorBoundary>
  );

  const orderedEntries = expandedRoot
    ? [...entries.filter((entry) => entry.id !== expandedRoot.id), expandedRoot]
    : entries;

  return (
    <>
      <header ref={headerRef} data-app-header data-print="hide" className="sticky top-0 z-40 border-b border-border bg-surface-raised">
        {canSeeRegistry && <ActivityIsland />}
        <div className="mx-auto flex min-h-16 max-w-(--page-max) flex-wrap items-center gap-x-4 gap-y-2 px-(--gutter) py-2 max-lg:min-h-12 max-lg:gap-x-3 max-lg:gap-y-2">
          <Link
            to="/home"
            data-testid="bento-home-link"
            aria-label={`${t('appName')} — ${t('nav.homeTitle')}`}
            className="flex h-11 min-w-0 shrink-0 items-center gap-2 text-text no-underline outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <img src="/ayqyn-mark.svg" alt="" aria-hidden="true" className="size-8 shrink-0 sm:size-9" />
            <span className="text-sm font-semibold tracking-[0.06em] sm:text-base">AYQYN</span>
          </Link>
          <div className="order-last min-w-0 basis-full lg:order-0 lg:min-w-48 lg:max-w-lg lg:flex-1 lg:basis-auto">
            <GlobalSearch />
          </div>
          <div role="group" aria-label={t('header.utilities')} className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
            {headerUtilities}
          </div>
        </div>
      </header>

      <div data-print="main-shell" className={cn(assistantOpen && 'min-[62em]:pr-(--assistant-w)')}>
        <main className="mx-auto min-h-[calc(100dvh-var(--header-h))] max-w-(--page-max) px-(--gutter) pt-5 pb-14 sm:pt-7">
          <MotionConfig reducedMotion="user" transition={bentoTransition}>
            <LayoutGroup id="bento-navigation">
              <div data-testid="bento-navigation" className="flex min-w-0 flex-col gap-4 sm:gap-5">
                {isHome && renderOutlet()}

                <nav aria-label={t('nav.primaryNavigation')} className="grid grid-cols-12 gap-[clamp(.4rem,.55vw,.65rem)]">
                  {orderedEntries.map((entry) => {
                    const isExpanded = expandedRoot?.id === entry.id;
                    const isParentExpanded = childRoute?.groupId === entry.id;
                    const isCurrentHub = groupHub?.id === entry.id;
                    const isCurrentEntry = isCurrentHub || routeGroup?.id === entry.id || route?.id === entry.id;
                    const testId = `bento-nav-card-${entry.id}`;

                    return (
                      <NavigationTile
                        key={entry.id}
                        item={entry}
                        mode={showHomeGrid ? 'home' : isExpanded ? 'expanded' : 'compact'}
                        current={isCurrentEntry}
                        expanded={isParentExpanded || isCurrentHub}
                        returnTo="/home"
                        returnLabel={t('nav.returnHome')}
                        testId={testId}
                        className={showHomeGrid ? homeGridClass(entry, entries.length) : isExpanded ? 'col-span-12' : compactGridClass}
                        focusRef={isExpanded ? sectionLinkRef : undefined}
                      >
                        {isExpanded && renderOutlet(groupHub)}
                      </NavigationTile>
                    );
                  })}
                </nav>

                {childRoute && childGroup && (
                  <nav
                    id="bento-leaf-navigation"
                    aria-label={t('nav.groupNavigation', { group: childGroup.label })}
                    className="grid grid-cols-12 gap-[clamp(.4rem,.55vw,.65rem)]"
                  >
                    {[
                      ...childGroup.items.filter((item) => item.id !== childRoute.id),
                      childRoute,
                    ].map((item: NavigationRoute) => {
                      const isSelected = item.id === childRoute.id;
                      return (
                        <NavigationTile
                          key={item.id}
                          item={item}
                          mode={isSelected ? 'expanded' : 'compact'}
                          current={isSelected}
                          returnTo={childGroup.to}
                          returnLabel={t('nav.backToGroup', { group: childGroup.label })}
                          testId={isSelected ? 'bento-selected-leaf' : `bento-leaf-card-${item.id}`}
                          className={isSelected ? 'col-span-12' : compactGridClass}
                          focusRef={isSelected ? sectionLinkRef : undefined}
                        >
                          {isSelected && renderOutlet(childGroup)}
                        </NavigationTile>
                      );
                    })}
                  </nav>
                )}

                {!isHome && !expandedRoot && !childRoute && renderOutlet()}
              </div>
            </LayoutGroup>
          </MotionConfig>
        </main>
      </div>
    </>
  );
}
