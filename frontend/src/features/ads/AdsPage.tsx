import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCamera, IconChevronLeft, IconChevronRight, IconPlus, IconRss } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAd, useAds, useTriageAd } from '@/api/hooks/ads';
import type { AdDetail, AdListParams, AdReviewState, AdRow } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorBlock } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/Chip';
import { SelectInput } from '@/components/form/SelectInput';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AdCard } from './AdCard';
import { AdFilters, type AdFilterValues } from './AdFilters';
import { AdsPager } from './AdsPager';
import { CaptureModal } from './CaptureModal';
import { ManualAdModal } from './ManualAdModal';
import { PAGE_SIZE, parseAdReviewState, parseAdStatus, parseDemo, parseId, parsePlatform } from './constants';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';
import { isHttpUrl } from './url';
import { errorMessage } from '@/api/queryClient';

function PublicationRow({ ad, selected, queueMode, onSelect }: { ad: AdRow; selected: boolean; queueMode: boolean; onSelect: () => void }) {
  const { t } = useTranslation('ads');
  const e = useEnum();
  const f = useFormat();
  const reviewLabels: Record<AdReviewState, string> = {
    unreviewed: t('review.inbox'),
    reviewed: t('review.reviewed'),
    deferred: t('review.deferred'),
    irrelevant: t('review.irrelevant'),
  };

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
      <span className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-2">
        <span>{ad.published_at ? f.dateTime(ad.published_at) : f.dateTime(ad.captured_at)}</span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <Chip tone={ad.status === 'verification' ? 'yellow' : ad.status === 'captured' ? 'green' : 'neutral'}>
            {e('ad_status', ad.status)}
          </Chip>
          {queueMode && <Chip tone={ad.review_state === 'reviewed' ? 'green' : ad.review_state === 'deferred' ? 'neutral' : 'yellow'}>{reviewLabels[ad.review_state]}</Chip>}
          {ad.duplicate_count > 0 && <Chip>{t('review.duplicateCount', { count: ad.duplicate_count + 1 })}</Chip>}
        </span>
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

function ReviewActions({
  ad,
  pending,
  onChange,
}: {
  ad: AdDetail;
  pending: boolean;
  onChange: (state: AdReviewState, note: string) => void;
}) {
  const { t } = useTranslation('ads');
  const [note, setNote] = useState(ad.review_note ?? '');
  const processing =
    ad.capture_status === 'pending' || ad.capture_status === 'failed' ||
    ad.ocr_status === 'pending' || ad.ocr_status === 'failed' ||
    ad.llm_status === 'pending' || ad.llm_status === 'failed';
  const unresolved = processing || ad.status === 'verification' || ad.phrase_hits.some((hit) => hit.confirmed === null);
  const confirmedLink = ad.object_id !== null && ad.status !== 'verification';
  const hasConfirmedFindings = ad.phrase_hits.some((hit) => hit.confirmed === true);
  const cannotMarkIrrelevant = confirmedLink || hasConfirmedFindings;

  return (
    <section aria-labelledby="ads-review-actions" className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
      <h3 id="ads-review-actions" className="mb-0 text-base font-semibold">{t('review.queueTitle')}</h3>
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-text-2">
        {t('review.noteLabel')}
        <Textarea value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder={t('review.notePlaceholder')} />
      </label>
      {unresolved && <p className="m-0 text-sm text-zone-yellow-ink" role="note">{t('review.reviewedBlocked')}</p>}
      {cannotMarkIrrelevant && <p className="m-0 text-sm text-zone-yellow-ink" role="note">{t('review.irrelevantBlocked')}</p>}
      <p className="m-0 text-sm text-text-2" role="note">{t('review.deferExplanation')}</p>
      <div className="flex flex-wrap gap-2">
        <Button className="max-sm:w-full" loading={pending} disabled={unresolved} onClick={() => onChange('reviewed', note)}>
          {t('review.markReviewed')}
        </Button>
        <Button className="max-sm:w-full" variant="secondary" loading={pending} onClick={() => onChange('deferred', note)}>
          {t('review.defer')}
        </Button>
        <Button className="max-sm:w-full" variant="outline" loading={pending} disabled={cannotMarkIrrelevant} onClick={() => onChange('irrelevant', note)}>
          {t('review.markIrrelevant')}
        </Button>
        {ad.review_state !== 'unreviewed' && (
          <Button className="max-sm:w-full" variant="secondary" loading={pending} onClick={() => onChange('unreviewed', note)}>
            {t('review.returnToQueue')}
          </Button>
        )}
      </div>
      {pending && <p className="m-0 text-sm text-text-2" role="status">{t('review.saving')}</p>}
    </section>
  );
}

function DuplicateNotice({ ad, onOpenGroup }: { ad: AdRow; onOpenGroup: () => void }) {
  const { t } = useTranslation('ads');
  const e = useEnum();
  if (ad.duplicate_count === 0) return null;

  return (
    <details aria-label={t('review.exactDuplicates')} className="rounded-lg border border-border bg-surface-sunken p-3">
      <summary className="cursor-pointer text-sm font-medium max-sm:min-h-11">
        {t('review.exactDuplicates')} · {t('review.duplicateCount', { count: ad.duplicate_count + 1 })}
      </summary>
      <div className="mt-2 flex min-w-0 flex-col gap-2">
      {ad.duplicate_instances.length > 0 && (
        <ul className="m-0 flex min-w-0 flex-col gap-1.5 p-0 text-sm">
          {ad.duplicate_instances.slice(0, 20).map((instance) => (
            <li key={instance.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Link className="text-link hover:underline" to={`/ads?duplicate_of=${ad.id}&ad=${instance.id}`}>
                {t('card.label', { id: instance.id })}
              </Link>
              <Chip>{e('platform', instance.platform)}</Chip>
              <span className="min-w-0 [overflow-wrap:anywhere] text-text-2">{t('review.duplicateSource', { source: instance.source_label })}</span>
              {instance.url && isHttpUrl(instance.url) && (
                <a className="min-w-0 truncate text-link hover:underline" href={instance.url} target="_blank" rel="noopener noreferrer">{instance.url}</a>
              )}
            </li>
          ))}
        </ul>
      )}
      {ad.duplicate_instances_truncated && <p className="m-0 text-sm text-text-2">{t('review.duplicateGroupTruncated')}</p>}
      <Button size="sm" variant="secondary" className="self-start max-sm:w-full" onClick={onOpenGroup}>
        {t('review.openDuplicateGroup')}
      </Button>
      </div>
    </details>
  );
}

export function AdsPage() {
  const { t } = useTranslation('ads');
  const { canEditRegistry } = useAuth();
  const [params, setParams] = useSearchParams();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [triageResult, setTriageResult] = useState<{ id: number; state: AdReviewState } | null>(null);
  const [completedAdId, setCompletedAdId] = useState<number | null>(null);
  const [pendingPageSelection, setPendingPageSelection] = useState<{ edge: 'first' | 'last'; page: number } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const filters: AdFilterValues = {
    platform: parsePlatform(params.get('platform')),
    objectId: parseId(params.get('object_id')),
    status: parseAdStatus(params.get('status')),
    demo: parseDemo(params.get('is_demo')),
    q: params.get('q') ?? '',
  };
  const reviewState = parseAdReviewState(params.get('review_state'));
  const queueMode = params.get('queue') === 'true' || reviewState !== null;
  const duplicateOf = parseId(params.get('duplicate_of'));
  const duplicateGroup = duplicateOf !== null;
  const page = parseId(params.get('page')) ?? 1;
  const adId = parseId(params.get('ad'));
  const focusHitId = parseId(params.get('hit'));

  const listParams: AdListParams = duplicateGroup
    ? { duplicate_of: duplicateOf, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
    : {
        platform: filters.platform ?? undefined,
        object_id: filters.objectId ?? undefined,
        status: !queueMode ? filters.status ?? undefined : undefined,
        is_demo: filters.demo ?? undefined,
        q: filters.q.trim() || undefined,
        queue: queueMode || undefined,
        review_state: queueMode ? reviewState ?? undefined : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      };
  const ads = useAds(listParams);
  const items = ads.data?.items ?? [];
  const total = ads.data?.total ?? 0;
  const edgeSelectionReady = Boolean(
    pendingPageSelection &&
      page === pendingPageSelection.page &&
      ads.data &&
      !ads.isError &&
      !ads.isFetching &&
      !ads.isPlaceholderData,
  );
  const edgeAd = edgeSelectionReady && pendingPageSelection?.edge === 'last' ? items.at(-1) : edgeSelectionReady ? items[0] : undefined;
  const selectedAdId = adId ?? completedAdId ?? (pendingPageSelection ? edgeAd?.id ?? null : items[0]?.id ?? null);
  const selectedAd = useAd(selectedAdId);
  const triageAd = useTriageAd();
  const hasFilters = filters.platform !== null || filters.objectId !== null || filters.status !== null || filters.demo !== null || filters.q.trim() !== '';
  const reviewFilter = reviewState && reviewState !== 'unreviewed' ? reviewState : 'inbox';
  const emptyResultsLoading = items.length === 0 && (ads.isPending || (ads.isFetching && !ads.isError));
  const showEmptyResults = Boolean(
    ads.data && items.length === 0 && !ads.isError && !ads.isFetching && !ads.isPending && !ads.isPlaceholderData,
  );

  const updateParams = useCallback((patch: Record<string, string | null>, options?: { replace?: boolean }) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, options), [setParams]);

  useEffect(() => {
    if (!edgeAd || !pendingPageSelection) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setPendingPageSelection(null);
      updateParams({ ad: String(edgeAd.id) }, { replace: true });
    });
    return () => { active = false; };
  }, [edgeAd, pendingPageSelection, updateParams]);

  const changeFilters = (patch: Partial<AdFilterValues>) => {
    setPendingPageSelection(null);
    const next: Record<string, string | null> = { page: null };
    if (patch.platform !== undefined) next.platform = patch.platform;
    if (patch.status !== undefined && !queueMode) next.status = patch.status;
    if (patch.demo !== undefined) next.is_demo = patch.demo === null ? null : String(patch.demo);
    if (patch.q !== undefined) next.q = patch.q;
    if (patch.objectId !== undefined) next.object_id = patch.objectId === null ? null : String(patch.objectId);
    updateParams(next);
  };

  const changePage = (nextPage: number) => {
    setPendingPageSelection({ edge: 'first', page: nextPage });
    setTriageResult(null);
    setCompletedAdId(null);
    updateParams({ page: nextPage > 1 ? String(nextPage) : null, ad: null, hit: null });
    feedRef.current?.scrollIntoView({ block: 'start' });
  };

  const showAd = (id: number) => {
    setPendingPageSelection(null);
    setTriageResult(null);
    setCompletedAdId(null);
    updateParams({ ad: String(id), hit: null });
  };
  const setQueueMode = (enabled: boolean) => {
    setPendingPageSelection(null);
    setTriageResult(null);
    setCompletedAdId(null);
    const next = new URLSearchParams(params);
    for (const key of ['platform', 'object_id', 'is_demo', 'q', 'ad', 'hit', 'duplicate_of']) {
      const value = params.get(key);
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    next.delete('review_state');
    if (enabled) next.set('queue', 'true');
    else next.delete('queue');
    setParams(next);
  };
  const changeReviewFilter = (value: string | null) => {
    setPendingPageSelection(null);
    const next = new URLSearchParams(params);
    next.set('queue', 'true');
    next.delete('page');
    next.delete('duplicate_of');
    if (value === 'inbox' || !value) next.delete('review_state');
    else next.set('review_state', value);
    setParams(next);
  };
  const resetFilters = () => {
    setPendingPageSelection(null);
    const next = new URLSearchParams();
    if (queueMode) {
      next.set('queue', 'true');
      if (reviewState && reviewState !== 'unreviewed') next.set('review_state', reviewState);
    }
    setParams(next);
  };
  const openDuplicateGroup = (id: number) => {
    setPendingPageSelection(null);
    const next = new URLSearchParams(params);
    next.set('duplicate_of', String(id));
    next.set('page', '1');
    next.delete('ad');
    next.delete('hit');
    setParams(next);
  };
  const leaveDuplicateGroup = () => {
    setPendingPageSelection(null);
    updateParams({ duplicate_of: null, page: null, ad: null, hit: null });
  };

  const changeTriage = (id: number, state: AdReviewState, note: string) => {
    const data = { state, note: note.trim() || null };
    setCompletedAdId(id);
    updateParams({ ad: String(id) });
    triageAd.mutate({ id, data }, {
      onSuccess: (result) => {
        setTriageResult({ id, state: result.review_state });
        if (state === 'unreviewed') updateParams({ review_state: null });
      },
    });
  };

  const goToNextPublication = () => {
    const currentIndex = items.findIndex((item) => item.id === selectedAdId);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    setTriageResult(null);
    setCompletedAdId(null);
    if (currentIndex === -1 && items[0]) {
      showAd(items[0].id);
    } else if (currentIndex >= 0 && currentIndex < items.length - 1) {
      showAd(items[currentIndex + 1]!.id);
    } else if (selectedIndex === -1 && total > 0) {
      const targetPage = page > pages ? pages : Math.max(1, page - 1);
      setPendingPageSelection({ edge: 'first', page: targetPage });
      updateParams({ page: String(targetPage), ad: null, hit: null });
    } else if (page < pages) {
      setPendingPageSelection({ edge: 'first', page: page + 1 });
      updateParams({ page: String(page + 1), ad: null, hit: null });
    } else {
      updateParams({ ad: null, hit: null });
    }
  };

  const selectedIndex = items.findIndex((item) => item.id === selectedAdId);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasNextPublication = selectedIndex === -1
    ? items.length > 0 || total > 0
    : selectedIndex < items.length - 1 || page < pages;

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

      {canEditRegistry && (
        <nav aria-label={t('review.modeLabel')} className="mb-4 flex flex-wrap gap-2">
          <Button variant={!queueMode ? 'default' : 'secondary'} aria-current={!queueMode ? 'page' : undefined} onClick={() => setQueueMode(false)}>
            {t('review.feedMode')}
          </Button>
          <Button variant={queueMode ? 'default' : 'secondary'} aria-current={queueMode ? 'page' : undefined} onClick={() => setQueueMode(true)}>
            {t('review.queueMode')}
          </Button>
        </nav>
      )}

      {queueMode && !duplicateGroup && (
        <div className="mb-4 max-w-md">
          <SelectInput
            label={t('review.stateLabel')}
            data={[
              { value: 'inbox', label: t('review.inbox') },
              { value: 'reviewed', label: t('review.reviewed') },
              { value: 'deferred', label: t('review.deferred') },
              { value: 'irrelevant', label: t('review.irrelevant') },
            ]}
            value={reviewFilter}
            onChange={changeReviewFilter}
          />
        </div>
      )}

      {!duplicateGroup && (
        <AdFilters
          values={filters}
          onChange={changeFilters}
          onReset={resetFilters}
          canReset={hasFilters}
          hideStatus={queueMode}
        />
      )}

      {duplicateGroup && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface px-4 py-3">
          <h2 className="m-0 text-base font-semibold">{t('review.duplicateGroupTitle')}</h2>
          <Button variant="secondary" onClick={leaveDuplicateGroup}>{t('review.leaveDuplicateGroup')}</Button>
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <section ref={feedRef} aria-labelledby="ads-results-title" className="order-2 min-w-0 overflow-hidden rounded-xl border border-border bg-surface lg:order-1" aria-busy={ads.isFetching}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 id="ads-results-title" className="mb-0 text-lg font-semibold">
              {duplicateGroup ? t('review.duplicateGroupTitle') : queueMode ? t('review.queueTitle') : t('feed.results')}
            </h2>
            {ads.data && <span className="text-sm tabular-nums text-text-2">{total}</span>}
          </div>
          {emptyResultsLoading && <FeedSkeleton />}
          {ads.isError && <ErrorBlock error={ads.error} onRetry={() => void ads.refetch()} />}
          {showEmptyResults && (
            <EmptyState
              action={
                total > 0 ? (
                  <Button variant="secondary" size="xs" onClick={() => changePage(1)}>{t('feed.firstPage')}</Button>
                ) : hasFilters ? (
                  <Button variant="secondary" size="xs" onClick={resetFilters}>{t('reset', { ns: 'common' })}</Button>
                ) : !queueMode && canEditRegistry ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="max-sm:min-h-11" onClick={() => setCaptureOpen(true)}>{t('actions.capture')}</Button>
                    <Button className="max-sm:min-h-11" variant="secondary" size="sm" onClick={() => setManualOpen(true)}>{t('actions.manual')}</Button>
                  </div>
                ) : undefined
              }
            >
              <strong>{total > 0 ? t('feed.pageEmpty') : queueMode ? t('review.noNext') : t('feed.empty')}</strong>
              {total === 0 && !queueMode && (
                <>
                  <br />
                  {t('feed.emptyHint')}
                </>
              )}
            </EmptyState>
          )}
          {items.map((ad) => (
            <PublicationRow key={ad.id} ad={ad} selected={ad.id === selectedAdId} queueMode={queueMode} onSelect={() => showAd(ad.id)} />
          ))}
        </section>

        <section aria-label={t('feed.pinned')} className="order-1 min-w-0 lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:order-2">
          {selectedAdId !== null && (
            <div className="mb-2 flex min-h-10 items-center justify-between gap-3 border-b border-border pb-2">
              <h2 className="mb-0 text-lg font-semibold">{queueMode ? t('review.queueTitle') : t('feed.pinned')}</h2>
              {adId !== null && (
              <Button variant="ghost" size="xs" onClick={() => { setCompletedAdId(null); setTriageResult(null); updateParams({ ad: null, hit: null }); }}>{t('feed.unpin')}</Button>
              )}
            </div>
          )}
          {queueMode && ads.data && selectedIndex >= 0 && triageResult?.id !== selectedAdId && (() => {
            return (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm tabular-nums text-text-2">
                  {t('review.progress', { current: (page - 1) * PAGE_SIZE + selectedIndex + 1, total })}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label={t('review.previous')}
                    disabled={selectedIndex <= 0 && page <= 1}
                    onClick={() => {
                      if (selectedIndex > 0) showAd(items[selectedIndex - 1]!.id);
                      else if (page > 1) {
                        setPendingPageSelection({ edge: 'last', page: page - 1 });
                        updateParams({ page: String(page - 1), ad: null, hit: null });
                      }
                    }}
                  >
                    <IconChevronLeft />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label={t('review.next')}
                    disabled={selectedIndex >= items.length - 1 && page >= pages}
                    onClick={() => {
                      if (selectedIndex < items.length - 1) showAd(items[selectedIndex + 1]!.id);
                      else if (page < pages) {
                        setPendingPageSelection({ edge: 'first', page: page + 1 });
                        updateParams({ page: String(page + 1), ad: null, hit: null });
                      }
                    }}
                  >
                    <IconChevronRight />
                  </Button>
                </div>
              </div>
            );
          })()}
          {selectedAdId === null && (emptyResultsLoading || (pendingPageSelection && (ads.isFetching || ads.isPlaceholderData))) && <FeedSkeleton count={1} />}
          {selectedAdId === null && showEmptyResults && <EmptyState>{queueMode ? t('review.noNext') : t('feed.empty')}</EmptyState>}
          {selectedAdId !== null && selectedAd.isPending && <FeedSkeleton count={1} />}
          {selectedAd.isError && <ErrorBlock error={selectedAd.error} onRetry={() => void selectedAd.refetch()} />}
          {selectedAd.data && (
            <div className="flex min-w-0 flex-col gap-4">
              <AdCard
                key={selectedAd.data.id}
                ad={selectedAd.data}
                highlighted={adId !== null}
                focusHitId={focusHitId}
                showReviewTasks={canEditRegistry && queueMode}
                reviewPanel={canEditRegistry && queueMode && !duplicateGroup ? (
                  <>
                    <ReviewActions ad={selectedAd.data} pending={triageAd.isPending} onChange={(state, note) => changeTriage(selectedAd.data!.id, state, note)} />
                    {triageAd.isError && triageAd.variables?.id === selectedAd.data.id && (
                      <p className="m-0 rounded border border-zone-red/40 bg-zone-red-bg p-3 text-sm text-zone-red-ink" role="alert">{errorMessage(triageAd.error)}</p>
                    )}
                  </>
                ) : undefined}
              />
              <DuplicateNotice ad={selectedAd.data} onOpenGroup={() => openDuplicateGroup(selectedAd.data.id)} />
              {triageResult?.id === selectedAd.data.id && (
                <aside className="flex flex-col gap-2 rounded border border-zone-green/40 bg-zone-green-bg p-3" role="status">
                  <strong className="text-sm">{t(`review.result.${triageResult.state}`)}</strong>
                  <span className="text-sm text-text-2">{t('review.resultHint')}</span>
                  <div className="flex flex-wrap gap-2">
                    {hasNextPublication ? (
                      <Button size="sm" onClick={goToNextPublication}>{t('review.next')}</Button>
                    ) : (
                      <span className="self-center text-sm text-text-2">{t('review.noNext')}</span>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => { setCompletedAdId(null); setTriageResult(null); updateParams({ ad: null, hit: null }); }}>{t('review.backToQueue')}</Button>
                  </div>
                </aside>
              )}
            </div>
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
