import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { useObject } from '@/api/hooks/objects';
import { useAd } from '@/api/hooks/ads';
import type { AdReviewState } from '@/api/types';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { DemoBadge } from '@/components/DemoBadge';
import { Chip } from '@/components/Chip';
import { EmptyState, ErrorBlock, LoadingBlock, QueryBoundary } from '@/components/QueryState';
import { Panel } from '@/components/Panel';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';
import { parseId } from './list/filters';
import { ObjectCard } from './card/ObjectCard';

const PUBLICATION_EXCERPT_LIMIT = 420;

function safeAdsReturnTo(value: string | null, adId: number | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin === window.location.origin && url.pathname === '/ads') {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      // Fall through to the local publication list.
    }
  }
  return adId === null ? '/ads' : `/ads?ad=${adId}`;
}

function PublicationContext({ adId, objectId, returnTo }: { adId: number; objectId: number; returnTo: string }) {
  const { t } = useTranslation('objects');
  const { t: ads } = useTranslation('ads');
  const e = useEnum();
  const { dateTime } = useFormat();
  const query = useAd(adId);
  const ad = query.data;
  const contextRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    context.focus({ preventScroll: true });
    context.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);
  const reviewLabel: Record<AdReviewState, string> = {
    unreviewed: ads('review.inbox'),
    reviewed: ads('review.reviewed'),
    deferred: ads('review.deferred'),
    irrelevant: ads('review.irrelevant'),
  };
  const publicationText = ad?.text?.trim() || ad?.url || t('card.publication.noText');
  const publicationExcerpt = publicationText.length > PUBLICATION_EXCERPT_LIMIT
    ? `${publicationText.slice(0, PUBLICATION_EXCERPT_LIMIT).trimEnd()}…`
    : publicationText;

  return (
    <div id="ads" ref={contextRef} tabIndex={-1} className="scroll-mt-[calc(var(--header-h)+16px)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
    <Panel title={t('card.publication.title')} className="mb-5">
      {query.isPending ? (
        <LoadingBlock />
      ) : query.isError || !ad || ad.object_id !== objectId ? (
        <>
          <p className="mb-3 text-sm text-text-2">{t('card.publication.unavailable')}</p>
          {query.isError && <ErrorBlock error={query.error} onRetry={() => void query.refetch()} />}
        </>
      ) : (
        <>
          <p className="mb-2 line-clamp-4 whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">
            {publicationExcerpt}
          </p>
          <p className="mb-3 text-sm text-text-2">
            {e('platform', ad.platform)} · {t('card.publication.saved', { value: dateTime(ad.original_captured_at) })}
            {ad.is_demo && <span className="ml-2 inline-flex align-middle"><DemoBadge /></span>}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Chip>{reviewLabel[ad.review_state]}</Chip>
            <Chip>{e('ad_status', ad.status)}</Chip>
          </div>
          <Button asChild variant="secondary" className="min-h-11">
            <Link to={`/ads?ad=${ad.id}`}>{t('card.publication.open')}</Link>
          </Button>
        </>
      )}
      <Button asChild variant="link" className="mt-2 min-h-11 px-0">
        <Link to={returnTo}>{t('card.publication.return')}</Link>
      </Button>
    </Panel>
    </div>
  );
}

function ObjectNotFound({ returnTo }: { returnTo?: string }) {
  const { t } = useTranslation('objects');
  return (
    <EmptyState
      action={returnTo ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to={returnTo}>{t('card.publication.return')}</Link>
          </Button>
          <Button asChild variant="link" size="sm">
            <Link to="/objects">{t('card.notFound.back')}</Link>
          </Button>
        </div>
      ) : (
        <Button asChild variant="secondary" size="sm">
          <Link to="/objects">{t('card.notFound.back')}</Link>
        </Button>
      )}
    >
      <strong>{t('card.notFound.title')}</strong>
      <br />
      {t('card.notFound.text')}
    </EmptyState>
  );
}

export function ObjectDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;
  const query = useObject(id, validId);
  const adId = parseId(searchParams.get('from_ad'));
  const returnTo = safeAdsReturnTo(searchParams.get('returnTo'), adId);

  if (!validId || (query.error instanceof ApiError && query.error.status === 404)) {
    return <ObjectNotFound returnTo={adId === null ? undefined : returnTo} />;
  }
  return (
    <QueryBoundary query={query}>
      {(object) => (
        <>
          {adId !== null && <PublicationContext adId={adId} objectId={object.id} returnTo={returnTo} />}
          <ObjectCard object={object} />
        </>
      )}
    </QueryBoundary>
  );
}
