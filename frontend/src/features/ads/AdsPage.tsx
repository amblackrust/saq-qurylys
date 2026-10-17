import { useRef, useState } from 'react';
import { IconCamera, IconPlus, IconRss } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAd, useAds } from '@/api/hooks/ads';
import type { AdRow } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorBlock } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/Chip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AdCard } from './AdCard';
import { AdFilters, type AdFilterValues } from './AdFilters';
import { AdsPager } from './AdsPager';
import { CaptureModal } from './CaptureModal';
import { ManualAdModal } from './ManualAdModal';
import { PAGE_SIZE, parseAdStatus, parseDemo, parseId, parsePlatform } from './constants';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';

function PublicationRow({ ad, selected, onSelect }: { ad: AdRow; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation('ads');
  const e = useEnum();
  const f = useFormat();

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={t('card.label', { id: ad.id })}
      onClick={onSelect}
      className={cn(
        'flex min-h-24 w-full flex-col items-stretch gap-2 border-b border-border px-4 py-3 text-left text-text transition-colors hover:bg-hover focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus',
        selected && 'bg-hover',
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-base font-semibold">{ad.author || ad.url || t('card.label', { id: ad.id })}</span>
        <Chip>{e('platform', ad.platform)}</Chip>
      </span>
      <span className="line-clamp-2 text-sm leading-5 text-text-2">{ad.text || t('card.noText')}</span>
      <span className="flex items-center justify-between gap-3 text-sm text-text-2">
        <span>{ad.published_at ? f.dateTime(ad.published_at) : f.dateTime(ad.captured_at)}</span>
        <Chip tone={ad.status === 'verification' ? 'yellow' : ad.status === 'captured' ? 'green' : 'neutral'}>
          {e('ad_status', ad.status)}
        </Chip>
      </span>
    </button>
  );
}

function FeedSkeleton({ count = 3 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" role="status" aria-label={t('loading')}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded border border-border bg-surface p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function AdsPage() {
  const { t } = useTranslation('ads');
  const { canEditRegistry } = useAuth();
  const [params, setParams] = useSearchParams();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const filters: AdFilterValues = {
    platform: parsePlatform(params.get('platform')),
    objectId: parseId(params.get('object_id')),
    status: parseAdStatus(params.get('status')),
    demo: parseDemo(params.get('is_demo')),
    q: params.get('q') ?? '',
  };
  const page = parseId(params.get('page')) ?? 1;
  const adId = parseId(params.get('ad'));
  const focusHitId = parseId(params.get('hit'));

  const ads = useAds({
    platform: filters.platform ?? undefined,
    object_id: filters.objectId ?? undefined,
    status: filters.status ?? undefined,
    is_demo: filters.demo ?? undefined,
    q: filters.q.trim() || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const items = ads.data?.items ?? [];
  const total = ads.data?.total ?? 0;
  const selectedAdId = adId ?? items[0]?.id ?? null;
  const selectedAd = useAd(selectedAdId);
  const canReset = params.size > 0;

  const updateParams = (patch: Record<string, string | null>) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });

  const changeFilters = (patch: Partial<AdFilterValues>) => {
    const next: Record<string, string | null> = { page: null };
    if (patch.platform !== undefined) next.platform = patch.platform;
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.demo !== undefined) next.is_demo = patch.demo === null ? null : String(patch.demo);
    if (patch.q !== undefined) next.q = patch.q;
    if (patch.objectId !== undefined) next.object_id = patch.objectId === null ? null : String(patch.objectId);
    updateParams(next);
  };

  const changePage = (nextPage: number) => {
    updateParams({ page: nextPage > 1 ? String(nextPage) : null });
    feedRef.current?.scrollIntoView({ block: 'start' });
  };

  const showAd = (id: number) => updateParams({ ad: String(id), hit: null });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          canEditRegistry && (
            <>
              <Button className="max-sm:min-h-11" onClick={() => setCaptureOpen(true)}>
                <IconCamera />
                {t('actions.capture')}
              </Button>
              <Button className="max-sm:min-h-11" variant="secondary" onClick={() => setManualOpen(true)}>
                <IconPlus />
                {t('actions.manual')}
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/sources">
                  <IconRss />
                  {t('actions.sources')}
                </Link>
              </Button>
            </>
          )
        }
      />
      <AdFilters
        values={filters}
        onChange={changeFilters}
        onReset={() => setParams(new URLSearchParams())}
        canReset={canReset}
      />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <section ref={feedRef} aria-labelledby="ads-results-title" className="order-2 min-w-0 overflow-hidden rounded-xl border border-border bg-surface lg:order-1" aria-busy={ads.isFetching}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 id="ads-results-title" className="mb-0 text-lg font-semibold">{t('feed.results')}</h2>
            {ads.data && <span className="text-sm tabular-nums text-text-2">{total}</span>}
          </div>
          {ads.isPending && <FeedSkeleton />}
          {ads.isError && <ErrorBlock error={ads.error} onRetry={() => void ads.refetch()} />}
          {ads.data && items.length === 0 && (
          <EmptyState
            action={
              total > 0 ? (
                <Button variant="secondary" size="xs" onClick={() => changePage(1)}>
                  {t('feed.firstPage')}
                </Button>
              ) : canReset ? (
                <Button variant="secondary" size="xs" onClick={() => setParams(new URLSearchParams())}>
                  {t('reset', { ns: 'common' })}
                </Button>
              ) : canEditRegistry ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="max-sm:min-h-11" onClick={() => setCaptureOpen(true)}>
                    {t('actions.capture')}
                  </Button>
                  <Button className="max-sm:min-h-11" variant="secondary" size="sm" onClick={() => setManualOpen(true)}>
                    {t('actions.manual')}
                  </Button>
                </div>
              ) : undefined
            }
          >
            <strong>{total > 0 ? t('feed.pageEmpty') : t('feed.empty')}</strong>
            {total === 0 && (
              <>
                <br />
                {t('feed.emptyHint')}
              </>
            )}
          </EmptyState>
          )}
          {items.map((ad) => (
            <PublicationRow key={ad.id} ad={ad} selected={ad.id === selectedAdId} onSelect={() => showAd(ad.id)} />
          ))}
        </section>

        <section aria-label={t('feed.pinned')} className="order-1 min-w-0 lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:order-2">
          {selectedAdId !== null && (
            <div className="mb-2 flex min-h-10 items-center justify-between gap-3 border-b border-border pb-2">
              <h2 className="mb-0 text-lg font-semibold">{t('feed.pinned')}</h2>
              {adId !== null && (
                <Button variant="ghost" size="xs" onClick={() => updateParams({ ad: null, hit: null })}>
                  {t('feed.unpin')}
                </Button>
              )}
            </div>
          )}
          {selectedAdId === null && ads.isPending && <FeedSkeleton count={1} />}
          {selectedAdId === null && ads.data && items.length === 0 && <EmptyState>{t('feed.empty')}</EmptyState>}
          {selectedAdId !== null && selectedAd.isPending && <FeedSkeleton count={1} />}
          {selectedAd.isError && <ErrorBlock error={selectedAd.error} onRetry={() => void selectedAd.refetch()} />}
          {selectedAd.data && (
            <AdCard key={selectedAd.data.id} ad={selectedAd.data} highlighted={adId !== null} focusHitId={focusHitId} />
          )}
        </section>
      </div>

      {items.length > 0 && <AdsPager page={page} total={total} onPageChange={changePage} />}

      {canEditRegistry && (
        <>
          <CaptureModal open={captureOpen} onClose={() => setCaptureOpen(false)} onCreated={showAd} />
          <ManualAdModal open={manualOpen} onClose={() => setManualOpen(false)} onCreated={showAd} />
        </>
      )}
    </>
  );
}
