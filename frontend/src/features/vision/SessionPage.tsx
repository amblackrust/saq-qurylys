import { useState } from 'react';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useTerritories } from '@/api/hooks/reference';
import { useMarkSessionReviewed, useUpdateVisionSession, useVisionConfig, useVisionFrames, useVisionSession } from '@/api/hooks/vision';
import type { VisionConfig, VisionFinding, VisionSessionDetail } from '@/api/types';
import { DemoBadge } from '@/components/DemoBadge';
import { SelectInput } from '@/components/form/SelectInput';
import { ObjectSelect } from '@/components/ObjectSelect';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, QueryBoundary } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { unwrapList } from '@/api/client';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';
import { confirmAction } from '@/lib/confirm';
import { flattenTerritories } from '@/lib/geo';
import { AssetsPanel } from './AssetsPanel';
import { FindingsPanels } from './FindingsPanels';
import { FrameViewer } from './FrameViewer';
import { FramesGallery } from './FramesGallery';
import { RunsPanel } from './RunsPanel';
import { SessionStatusChips } from './SessionStatusChips';
import { UploadPanel } from './UploadPanel';

function ObjectField({ session }: { session: VisionSessionDetail }) {
  const { t } = useTranslation('vision');
  const { t: tc } = useTranslation();
  const update = useUpdateVisionSession(session.id);
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const current = session.object?.id ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {session.object ? (
        <Link to={`/objects/${session.object.id}`} className="font-semibold [overflow-wrap:anywhere]">
          {session.object.code} · {session.object.name}
        </Link>
      ) : (
        <span className="text-text-3">{t('unlinked')}</span>
      )}
      <Popover
        open={opened}
        onOpenChange={(next) => {
          if (next) setDraft(current);
          setOpened(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button size="xs" variant="secondary">
            {session.object ? t('header.change') : t('header.attach')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 gap-3 p-3">
          <ObjectSelect
            label={t('new.object')}
            placeholder={t('new.objectPlaceholder')}
            value={draft}
            onChange={setDraft}
            territoryId={session.territory_id ?? undefined}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpened(false)}>
              {tc('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={draft === current}
              loading={update.isPending}
              onClick={() => update.mutate({ object_id: draft }, { onSuccess: () => setOpened(false) })}
            >
              {tc('save')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SessionView({ session, config }: { session: VisionSessionDetail; config: VisionConfig }) {
  const { t } = useTranslation('vision');
  const { t: tc } = useTranslation();
  const e = useEnum();
  const f = useFormat();
  const markReviewed = useMarkSessionReviewed(session.id);
  const update = useUpdateVisionSession(session.id);
  const territoriesQuery = useTerritories();
  const territories = territoriesQuery.data ? flattenTerritories(unwrapList(territoriesQuery.data)) : [];
  const sessionTerritory = territories.find((territory) => territory.id === session.territory_id);
  const childCities = territories.filter((territory) => territory.level === 'city' && territory.parent_id === session.territory_id);
  const hasPublishedAds = session.findings.some((finding) => finding.ad_post_id !== null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewer, setViewer] = useState<{ frameId: number; findingId: number | null } | null>(null);
  const frames = useVisionFrames(session.id, page, session.processing);
  const markedFrameIds = new Set(session.findings.flatMap((finding) => (finding.frame_id !== null ? [finding.frame_id] : [])));
  const pendingModelFrameIds = new Set(
    session.findings.flatMap((finding) =>
      finding.origin === 'model' && finding.review_state === 'pending' && finding.frame_id !== null ? [finding.frame_id] : [],
    ),
  );

  const showFinding = (finding: VisionFinding) => {
    if (finding.frame_id !== null) setViewer({ frameId: finding.frame_id, findingId: finding.id });
  };
  const askReviewed = () =>
    confirmAction({
      title: t('header.reviewTitle'),
      message: t('header.reviewMessage'),
      confirmLabel: t('header.review'),
      onConfirm: () => markReviewed.mutate(),
    });

  const meta: [string, React.ReactNode][] = [
    [t('header.source'), e('vision_source', session.source)],
    [t('header.capturedAt'), <span key="c" className="tabular-nums">{f.dateTime(session.captured_at)}</span>],
    [t('header.createdAt'), <span key="n" className="tabular-nums">{f.dateTime(session.created_at)} · {session.created_by_name ?? '—'}</span>],
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {t('session.title', { id: session.id })}
            {session.is_demo && <DemoBadge />}
          </span>
        }
        subtitle={<SessionStatusChips session={session} />}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link to="/vision">
                <IconArrowLeft />
                {t('session.back')}
              </Link>
            </Button>
            {session.status === 'open' && (
              <Button loading={markReviewed.isPending} onClick={askReviewed}>
                <IconCheck />
                {t('header.review')}
              </Button>
            )}
          </>
        }
      />
      <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,25rem)]">
        <div className="order-2 grid min-w-0 gap-8 lg:order-1">
        <div role="note" className="rounded-xl border border-border-strong bg-surface-sunken px-4 py-3 text-base leading-relaxed text-text-2">
          {config.detector_mode === 'experimental_pretrained' ? (
            <>
              {t('banner.detectorExperimental')}
              {config.detector_model && (
                <>
                  {' '}
                  <details className="mt-2 text-sm text-text-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-text-2">{t('banner.modelLabel')}</summary>
                    <span className="[overflow-wrap:anywhere]">{config.detector_model}</span>
                  </details>
                </>
              )}
            </>
          ) : config.ocr_enabled ? (
            t('banner.detectorOff')
          ) : (
            t('banner.detectorAndOcrOff')
          )}
        </div>
        <section aria-label={t('frames.title')} className="min-w-0">
          <FramesGallery
            frames={frames.data}
            error={frames.error}
            onRetry={() => void frames.refetch()}
            page={page}
            onPageChange={setPage}
            onOpen={(frameId) => setViewer({ frameId, findingId: null })}
            markedFrameIds={markedFrameIds}
            pendingModelFrameIds={pendingModelFrameIds}
          />
        </section>
        <AssetsPanel assets={session.assets} />
        </div>

        <aside className="order-1 grid min-w-0 content-start gap-6 lg:sticky lg:top-[calc(var(--header-h)_+_1.5rem)] lg:order-2">
          {territoriesQuery.isError && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zone-red-line bg-zone-red-soft px-4 py-3 text-sm text-zone-red-ink" role="alert">
              <span>{t('territoryRefinement.loadError')}</span>
              <Button type="button" size="xs" variant="secondary" onClick={() => void territoriesQuery.refetch()}>
                {tc('retry')}
              </Button>
            </div>
          )}
          {sessionTerritory?.level === 'region' && (
            <section className="grid min-w-0 gap-3 rounded-xl border border-border bg-surface p-5" aria-labelledby="vision-city-refinement-title">
              <h2 id="vision-city-refinement-title" className="m-0 text-lg font-semibold text-text">
                {t('territoryRefinement.title')}
              </h2>
              <p className="m-0 text-sm leading-relaxed text-text-2">{t('territoryRefinement.message')}</p>
              <SelectInput
                label={t('territoryRefinement.city')}
                placeholder={t('territoryRefinement.placeholder')}
                data={childCities.map((city) => ({ value: String(city.id), label: city.name }))}
                value={cityId}
                onChange={setCityId}
                searchable
                loading={territoriesQuery.isPending}
                disabled={territoriesQuery.isError || territoriesQuery.isPending || hasPublishedAds || childCities.length === 0}
                nothingFound={tc('states.empty')}
              />
              {childCities.length === 0 && !territoriesQuery.isPending && !territoriesQuery.isError && !hasPublishedAds && (
                <p className="m-0 text-sm text-text-3">{t('territoryRefinement.noCities')}</p>
              )}
              {hasPublishedAds && <p className="m-0 text-sm text-zone-red-ink">{t('territoryRefinement.hasPublishedAds')}</p>}
              {update.isError && <p className="m-0 text-sm text-zone-red-ink" role="alert">{t('territoryRefinement.saveError')}</p>}
              <div className="flex justify-end">
                <Button
                  type="button"
                  loading={update.isPending}
                  disabled={territoriesQuery.isError || territoriesQuery.isPending || cityId === null || hasPublishedAds}
                  onClick={() => update.mutate({ territory_id: Number(cityId) })}
                >
                  {t('territoryRefinement.save')}
                </Button>
              </div>
            </section>
          )}
          <section className="grid min-w-0 gap-4 rounded-xl border border-border bg-surface p-5">
            <h2 className="m-0 text-lg font-semibold text-text">{t('header.title')}</h2>
          <dl className="m-0 grid gap-x-4 gap-y-3 text-base sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-1">
            <dt className="text-text-3">{t('header.object')}</dt>
            <dd className="m-0">
              <ObjectField session={session} />
            </dd>
            {meta.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-text-3">{label}</dt>
                <dd className="m-0">{value}</dd>
              </div>
            ))}
            {session.status === 'reviewed' && (
              <>
                <dt className="text-text-3">{t('header.reviewedBy')}</dt>
                <dd className="m-0 tabular-nums">
                  {f.dateTime(session.reviewed_at)} · {session.reviewed_by_name ?? '—'}
                </dd>
              </>
            )}
            {session.note && (
              <>
                <dt className="text-text-3">{t('header.note')}</dt>
                <dd className="m-0 [overflow-wrap:anywhere]">{session.note}</dd>
              </>
            )}
          </dl>
          </section>
          <RunsPanel session={session} config={config} />
          <UploadPanel sessionId={session.id} config={config} />
          <FindingsPanels session={session} config={config} onShow={showFinding} />
        </aside>
      </div>
      {viewer && (
        <FrameViewer
          session={session}
          frameId={viewer.frameId}
          frames={frames.data?.items ?? []}
          focusFindingId={viewer.findingId}
          onFrameChange={(frameId) => setViewer({ frameId, findingId: null })}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}

export function SessionPage() {
  const { t } = useTranslation('vision');
  const params = useParams();
  const id = Number(params.id);
  const config = useVisionConfig();
  const session = useVisionSession(Number.isInteger(id) && id > 0 ? id : 0);

  if (!Number.isInteger(id) || id <= 0) return <EmptyState>{t('session.notFound')}</EmptyState>;
  return (
    <QueryBoundary query={session}>
      {(data) => (config.data ? <SessionView session={data} config={config.data} /> : null)}
    </QueryBoundary>
  );
}
