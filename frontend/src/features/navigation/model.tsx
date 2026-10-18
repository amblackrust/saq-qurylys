import type { ReactNode } from 'react';
import {
  IconBuildingSkyscraper,
  IconChartDots3,
  IconEye,
  IconLayoutDashboard,
  IconMap2,
  IconRss,
  IconSend,
  IconSettings,
  IconSpeakerphone,
  IconUserCheck,
} from '@tabler/icons-react';

export type AdsView = 'queue' | 'archive';

export interface NavigationRoute {
  kind: 'route';
  id: string;
  to: string;
  label: string;
  purpose: string;
  icon: ReactNode;
  groupId?: string;
  adsView?: AdsView;
}

export interface NavigationGroup {
  kind: 'group';
  id: string;
  to: string;
  label: string;
  purpose: string;
  icon: ReactNode;
  items: NavigationRoute[];
}

export type NavigationEntry = NavigationRoute | NavigationGroup;

interface NavigationOptions {
  canSeeRegistry: boolean;
  canEditRegistry: boolean;
  isAdmin: boolean;
  visionEnabled: boolean;
  t: (key: string) => string;
}

function route(
  t: NavigationOptions['t'],
  id: string,
  to: string,
  labelKey: string,
  purposeKey: string,
  icon: ReactNode,
  groupId?: string,
  adsView?: AdsView,
): NavigationRoute {
  return { kind: 'route', id, to, label: t(labelKey), purpose: t(purposeKey), icon, groupId, adsView };
}

function group(
  t: NavigationOptions['t'],
  id: string,
  labelKey: string,
  purposeKey: string,
  icon: ReactNode,
  items: NavigationRoute[],
): NavigationGroup {
  return {
    kind: 'group',
    id,
    to: `/home/${id}`,
    label: t(labelKey),
    purpose: t(purposeKey),
    icon,
    items,
  };
}

export function createNavigationModel(options: NavigationOptions): NavigationEntry[] {
  const { canSeeRegistry, canEditRegistry, isAdmin, visionEnabled, t } = options;

  if (isAdmin) {
    const overview = route(t, 'work', '/work', 'nav.adminOverview', 'nav.purpose.adminOverview', <IconLayoutDashboard />);
    const administration = route(t, 'admin', '/admin', 'nav.admin', 'nav.purpose.admin', <IconSettings />);
    const data = group(t, 'data', 'nav.sectionData', 'nav.purpose.data', <IconBuildingSkyscraper />, [
      route(t, 'adsArchive', '/ads', 'nav.adsArchive', 'nav.purpose.adsArchive', <IconSpeakerphone />, 'data', 'archive'),
      route(t, 'objects', '/objects', 'nav.objects', 'nav.purpose.objects', <IconBuildingSkyscraper />, 'data'),
      route(t, 'signals', '/signals', 'nav.signals', 'nav.purpose.signals', <IconSend />, 'data'),
    ]);
    const tools = group(t, 'tools', 'nav.sectionTools', 'nav.purpose.tools', <IconSettings />, [
      ...(canEditRegistry ? [route(t, 'control', '/control', 'nav.control', 'nav.purpose.control', <IconUserCheck />, 'tools')] : []),
      route(t, 'sources', '/sources', 'nav.sources', 'nav.purpose.sources', <IconRss />, 'tools'),
      route(t, 'map', '/map', 'nav.map', 'nav.purpose.map', <IconMap2 />, 'tools'),
      route(t, 'graph', '/graph', 'nav.graph', 'nav.purpose.graph', <IconChartDots3 />, 'tools'),
      ...(canSeeRegistry && visionEnabled
        ? [route(t, 'vision', '/vision', 'nav.vision', 'nav.purpose.vision', <IconEye />, 'tools')]
        : []),
    ]);
    return [overview, administration, data, tools];
  }

  if (!canSeeRegistry) {
    return [route(t, 'signals', '/signals', 'nav.recipientSignals', 'nav.purpose.recipientSignals', <IconSend />)];
  }

  const flow: NavigationRoute[] = [
    route(t, 'work', '/work', 'nav.work', 'nav.purpose.work', <IconLayoutDashboard />),
    route(t, 'adsQueue', '/ads?queue=true', 'nav.ads', 'nav.purpose.adsQueue', <IconSpeakerphone />, undefined, 'queue'),
    route(t, 'signals', '/signals', 'nav.signals', 'nav.purpose.signals', <IconSend />),
    route(t, 'objects', '/objects', 'nav.objects', 'nav.purpose.objects', <IconBuildingSkyscraper />),
  ];
  const explore = group(t, 'explore', 'nav.sectionExplore', 'nav.purpose.explore', <IconMap2 />, [
    route(t, 'map', '/map', 'nav.map', 'nav.purpose.map', <IconMap2 />, 'explore'),
    route(t, 'graph', '/graph', 'nav.graph', 'nav.purpose.graph', <IconChartDots3 />, 'explore'),
  ]);
  const tools = group(t, 'tools', 'nav.sectionTools', 'nav.purpose.tools', <IconSettings />, [
    ...(canEditRegistry ? [route(t, 'control', '/control', 'nav.control', 'nav.purpose.control', <IconUserCheck />, 'tools')] : []),
    route(t, 'adsArchive', '/ads', 'nav.adsArchive', 'nav.purpose.adsArchive', <IconSpeakerphone />, 'tools', 'archive'),
    ...(canEditRegistry ? [route(t, 'sources', '/sources', 'nav.sources', 'nav.purpose.sources', <IconRss />, 'tools')] : []),
    ...(visionEnabled ? [route(t, 'vision', '/vision', 'nav.vision', 'nav.purpose.vision', <IconEye />, 'tools')] : []),
  ]);

  return [...flow, explore, tools];
}

export function getNavigationRoutes(entries: NavigationEntry[]): NavigationRoute[] {
  return entries.flatMap((entry) => (entry.kind === 'group' ? entry.items : [entry]));
}

export function getNavigationGroup(entries: NavigationEntry[], groupId: string | undefined) {
  if (!groupId) return undefined;
  return entries.find((entry): entry is NavigationGroup => entry.kind === 'group' && entry.id === groupId);
}

export function matchNavigationRoute(routes: NavigationRoute[], pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return routes.find((entry) => {
    if (entry.adsView) {
      return pathname === '/ads' && (params.get('queue') === 'true') === (entry.adsView === 'queue');
    }
    const basePath = entry.to.split('?')[0];
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  });
}

export function matchNavigationGroupHub(entries: NavigationEntry[], pathname: string) {
  const match = pathname.match(/^\/home\/([^/]+)\/?$/);
  return getNavigationGroup(entries, match?.[1]);
}
