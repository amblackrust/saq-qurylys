import { useLayoutEffect, useRef, useState } from 'react';
import { IconChevronRight, IconTopologyStar3 } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ObjectDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreakdownList } from './BreakdownList';
import { ComplaintsSection } from './ComplaintsSection';
import { DocumentsSection } from './DocumentsSection';
import { InspectionsSection } from './InspectionsSection';
import { LinkedEntitiesSection } from './LinkedEntitiesSection';
import { ObjectHeader } from './ObjectHeader';
import { ObjectReviewActions } from './ObjectReviewActions';
import { PassportSection } from './PassportSection';
import { RiskPanel } from './RiskPanel';
import { ScoreHistory } from './ScoreHistory';
import { VisionSection } from './VisionSection';

type ObjectSection = 'review' | 'details' | 'materials';

function isObjectSection(value: string): value is ObjectSection {
  return value === 'review' || value === 'details' || value === 'materials';
}

function sectionForHash(hash: string): ObjectSection | null {
  const id = hash.slice(1);
  if (id === 'documents' || /^doc-\d+$/.test(id)) return 'review';
  if (id === 'inspections' || /^inspection-\d+$/.test(id) || id === 'complaints' || /^complaint-\d+$/.test(id)) {
    return 'materials';
  }
  return null;
}

function scrollToHashTarget(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
  const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

export function ObjectCard({ object }: { object: ObjectDetail }) {
  const { t } = useTranslation('objects');
  const { t: tGraph } = useTranslation('graph');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [section, setSection] = useState<ObjectSection>(() => sectionForHash(window.location.hash) ?? 'review');
  const [hashRevision, setHashRevision] = useState(0);
  const pendingHashTarget = useRef(window.location.hash.slice(1));
  const lastSyncedUrl = useRef(window.location.href);

  useLayoutEffect(() => {
    const target = pendingHashTarget.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      if (pendingHashTarget.current !== target) return;
      if (!document.getElementById(target)) return;
      pendingHashTarget.current = '';
      scrollToHashTarget(target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [section, hashRevision]);

  useLayoutEffect(() => {
    const syncHash = () => {
      if (window.location.href === lastSyncedUrl.current) return;
      lastSyncedUrl.current = window.location.href;
      const hash = window.location.hash;
      pendingHashTarget.current = hash.slice(1);
      const nextSection = sectionForHash(hash);
      if (nextSection) setSection(nextSection);
      setHashRevision((revision) => revision + 1);
    };
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, [object.id]);

  return (
    <div
      onClick={(event) => {
        if (!(event.target instanceof Element)) return;
        const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
        if (!anchor || anchor.hash !== window.location.hash) return;
        const nextSection = sectionForHash(anchor.hash);
        if (!nextSection || nextSection === section) return;
        pendingHashTarget.current = anchor.hash.slice(1);
        setSection(nextSection);
      }}
    >
      <ObjectHeader object={object} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <Tabs
          value={section}
          onValueChange={(value) => {
            if (isObjectSection(value)) setSection(value);
          }}
          className="order-2 min-w-0 lg:order-1"
        >
          <TabsList aria-label={t('card.workspace.title')} className="w-full overflow-x-auto">
            <TabsTrigger value="review">{t('card.workspace.review')}</TabsTrigger>
            <TabsTrigger value="details">{t('card.workspace.details')}</TabsTrigger>
            <TabsTrigger value="materials">{t('card.workspace.materials')}</TabsTrigger>
          </TabsList>
          <TabsContent value="review" className="mt-5 space-y-5">
            <DocumentsSection object={object} />
          </TabsContent>
          <TabsContent value="details" className="mt-5 space-y-5">
            <PassportSection object={object} />
            <LinkedEntitiesSection object={object} />
          </TabsContent>
          <TabsContent value="materials" className="mt-5 space-y-5">
            <InspectionsSection object={object} />
            <VisionSection object={object} />
            <ComplaintsSection object={object} />
          </TabsContent>
        </Tabs>
        <aside className="order-1 flex min-w-0 flex-col gap-5 lg:order-2" aria-label={t('card.workspace.inspector')}>
          <ObjectReviewActions object={object} />
          <RiskPanel object={object} />
        </aside>
      </div>
      <details
        className="mt-6 border-t border-border pt-3"
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary className="group flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium text-text-2 hover:text-text focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          <IconChevronRight
            size={16}
            className="transition-transform duration-(--dur) group-open:rotate-90"
            aria-hidden
          />
          {t('card.more.title')}
        </summary>
        {detailsOpen && (
          <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
            <BreakdownList score={object.latest_score} />
            <div className="flex min-w-0 flex-col gap-4">
              <ScoreHistory objectId={object.id} />
              <Button asChild variant="secondary" className="min-h-11 self-start">
                <Link to={`/graph?object_id=${object.id}`}>
                  <IconTopologyStar3 />
                  {tGraph('open')}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </details>
    </div>
  );
}
