import { Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  IconBuildingSkyscraper,
  IconChartDots3,
  IconEye,
  IconLayoutDashboard,
  IconMap2,
  IconMenu2,
  IconRss,
  IconSend,
  IconSettings,
  IconSparkles,
  IconSpeakerphone,
  IconX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAssistantEnabled } from '@/api/hooks/assistant';
import { useVisionEnabled } from '@/api/hooks/vision';
import { useAuth } from '@/auth/useAuth';
import { LoadingBlock } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AssistantPanel } from '@/features/assistant/AssistantPanel';
import { usePanelState } from '@/features/assistant/usePanelState';
import { cn } from '@/lib/utils';
import { ActivityIsland } from './ActivityIsland';
import { AppearanceMenu } from './AppearanceMenu';
import { LanguageSwitch } from './LanguageSwitch';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';

interface RouteItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium no-underline transition-colors duration-(--dur)',
    'text-text-2 hover:bg-hover hover:text-text focus-visible:ring-2 focus-visible:ring-focus',
    isActive && 'bg-hover text-accent-text hover:bg-hover hover:text-accent-text',
  );

function RouteLink({ item, onNavigate }: { item: RouteItem; onNavigate?: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} className={itemClass} onClick={onNavigate}>
      <span className="grid size-6 shrink-0 place-items-center [&_svg]:size-5" aria-hidden>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </NavLink>
  );
}

function RouteGroup({ title, items, onNavigate }: { title: string; items: RouteItem[]; onNavigate?: () => void }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h2 className="px-3 pb-1 text-[13px] font-semibold text-text-3">{title}</h2>
      {items.map((item) => <RouteLink key={item.to} item={item} onNavigate={onNavigate} />)}
    </section>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { canSeeRegistry, canEditRegistry, isAdmin } = useAuth();
  const location = useLocation();
  const visionEnabled = useVisionEnabled();
  const assistantEnabled = useAssistantEnabled();
  const assistant = usePanelState();
  const askAiRef = useRef<HTMLButtonElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const assistantOpen = assistantEnabled && assistant.open;

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setMobileNavOpen(false);
    };
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  const flowItems: RouteItem[] = [
    ...(canSeeRegistry ? [{ to: '/work', label: t('nav.work'), icon: <IconLayoutDashboard /> }] : []),
    ...(canSeeRegistry ? [{ to: '/ads', label: t('nav.ads'), icon: <IconSpeakerphone /> }] : []),
    ...(canSeeRegistry ? [{ to: '/objects', label: t('nav.objects'), icon: <IconBuildingSkyscraper /> }] : []),
    { to: '/signals', label: t('nav.signals'), icon: <IconSend /> },
  ];
  const exploreItems: RouteItem[] = canSeeRegistry ? [
    { to: '/map', label: t('nav.map'), icon: <IconMap2 /> },
    { to: '/graph', label: t('nav.graph'), icon: <IconChartDots3 /> },
  ] : [];
  const toolsItems: RouteItem[] = [
    ...(canEditRegistry ? [{ to: '/sources', label: t('nav.sources'), icon: <IconRss /> }] : []),
    ...(canSeeRegistry && visionEnabled ? [{ to: '/vision', label: t('nav.vision'), icon: <IconEye /> }] : []),
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin'), icon: <IconSettings /> }] : []),
  ];

  const pageTitle = [...flowItems, ...exploreItems, ...toolsItems].find(({ to }) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`),
  )?.label ?? t('appName');

  const closeAssistant = () => {
    assistant.setOpen(false);
    askAiRef.current?.focus();
  };

  const sidebar = (onNavigate?: () => void) => (
    <>
      <Link to="/" aria-label={t('appName')} onClick={onNavigate} className="flex h-16 items-center gap-3 px-4 text-text no-underline">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">S</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight">SAQ QURYLYS</span>
          <span className="mt-1 text-[13px] text-text-3">{t('nav.workspace')}</span>
        </span>
      </Link>
      <nav aria-label={t('header.menu')} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <RouteGroup title={t('nav.sectionWork')} items={flowItems} onNavigate={onNavigate} />
        {canSeeRegistry && <RouteGroup title={t('nav.sectionExplore')} items={exploreItems} onNavigate={onNavigate} />}
        <RouteGroup title={t('nav.sectionTools')} items={toolsItems} onNavigate={onNavigate} />
      </nav>
      <div className="flex flex-col gap-2 border-t border-border p-3">
        <AppearanceMenu />
        <div className="flex items-center justify-between gap-2">
          <LanguageSwitch />
          <UserMenu />
        </div>
      </div>
    </>
  );

  return (
    <div
      className="min-h-dvh"
      style={{ '--assistant-w': assistant.expanded ? 'min(640px, 60vw)' : 'min(400px, 40vw)' } as CSSProperties}
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) flex-col border-r border-border bg-surface-glass backdrop-blur-xl lg:flex">
        {sidebar()}
      </aside>

      <div className="min-h-dvh lg:ml-(--sidebar-w)">
        <header className="sticky top-0 z-40 border-b border-border bg-surface-glass backdrop-blur-xl">
          <div className="flex h-(--header-h) items-center gap-3 px-(--gutter)">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 lg:hidden"
                  aria-label={mobileNavOpen ? t('close') : t('header.menu')}
                >
                  {mobileNavOpen ? <IconX /> : <IconMenu2 />}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(320px,88vw)] max-w-none gap-0 p-0 lg:hidden"
                showCloseButton={false}
                onCloseAutoFocus={(event) => {
                  if (window.matchMedia('(min-width: 64rem)').matches) {
                    event.preventDefault();
                    document.querySelector<HTMLElement>('[data-page-title]')?.focus();
                  }
                }}
              >
                <SheetTitle className="sr-only">{t('header.menu')}</SheetTitle>
                {sidebar(() => setMobileNavOpen(false))}
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1 lg:flex-none">
              <h1 data-page-title tabIndex={-1} className="truncate text-lg font-semibold tracking-tight text-text">{pageTitle}</h1>
            </div>
            <div role="group" aria-label={t('header.utilities')} className="ml-auto flex items-center gap-1">
              {assistantEnabled && (
                <Button
                  ref={askAiRef}
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={t('header.askAi')}
                  title={t('header.askAi')}
                  aria-pressed={assistantOpen}
                  onClick={() => (assistantOpen ? closeAssistant() : assistant.setOpen(true))}
                >
                  <IconSparkles />
                </Button>
              )}
              <NotificationsBell />
              <div className="lg:hidden"><UserMenu /></div>
            </div>
          </div>
          {canSeeRegistry && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
              <div className="relative h-0 px-(--gutter)"><ActivityIsland /></div>
            </div>
          )}
        </header>
        <div className={cn(assistantOpen && 'min-[62em]:pr-(--assistant-w)')}>
          <main className="mx-auto min-h-[calc(100dvh-var(--header-h))] max-w-(--page-max) px-(--gutter) pt-8 pb-14 max-sm:pt-6">
            <Suspense fallback={<LoadingBlock />}>
              <div className="animate-in duration-200 fade-in-0 slide-in-from-bottom-1"><Outlet /></div>
            </Suspense>
          </main>
        </div>
      </div>
      {assistantEnabled && (
        <AssistantPanel open={assistantOpen} expanded={assistant.expanded} onToggleExpanded={assistant.toggleExpanded} onClose={closeAssistant} />
      )}
    </div>
  );
}
