import { useState } from 'react';
import { IconAlertTriangle, IconArrowLeft, IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCollectors, useSourceAccounts } from '@/api/hooks/ads';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { QueryBoundary } from '@/components/QueryState';
import { COLLECTOR_SOURCES, isCollectorOn } from './collectors';
import { CollectorBadges } from './CollectorBadges';
import { SourceFormModal } from './SourceFormModal';
import { SourcesTable } from './SourcesTable';

export function SourcesPage() {
  const { t } = useTranslation('sources');
  const accounts = useSourceAccounts();
  const collectors = useCollectors();
  const [adding, setAdding] = useState(false);
  const collectorStatuses = collectors.data;
  const enabledCount = collectorStatuses
    ? COLLECTOR_SOURCES.filter((source) => isCollectorOn(source, collectorStatuses)).length
    : 0;
  const disabledCount = COLLECTOR_SOURCES.length - enabledCount;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link to="/ads">
                <IconArrowLeft />
                {t('backToAds')}
              </Link>
            </Button>
            <Button className="max-sm:min-h-11" onClick={() => setAdding(true)}>
              <IconPlus />
              {t('add')}
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <section aria-label={t('title')} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <QueryBoundary query={accounts}>
            {(rows) => <SourcesTable accounts={rows} collectors={collectors.data} />}
          </QueryBoundary>
        </section>
        <aside className="min-w-0 rounded-xl border border-border bg-surface p-4" aria-label={t('collectors.title')}>
          <h2 className="mb-3 text-lg font-semibold">{t('collectors.title')}</h2>
          {collectors.data ? (
            <div className="mb-4 border-b border-border pb-4">
              <p className="m-0 text-base font-semibold">{t('collectors.summary', { enabled: enabledCount, total: COLLECTOR_SOURCES.length })}</p>
              {disabledCount > 0 && <p className="mb-0 mt-2 text-sm leading-5 text-text-2">{t('collectors.offHint')}</p>}
              {disabledCount > 0 && (
                <Button className="mt-3 min-h-11 w-full" variant="secondary" size="sm" asChild>
                  <Link to="/ads">{t('collectors.manualAdd')}</Link>
                </Button>
              )}
            </div>
          ) : null}
          {collectors.isError ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zone-red-ink" role="alert">
              <IconAlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>{t('collectors.loadError')}</span>
              <Button variant="secondary" size="xs" onClick={() => void collectors.refetch()}>
                {t('retry', { ns: 'common' })}
              </Button>
            </div>
          ) : collectors.isPending ? (
            <p className="m-0 mb-4 text-sm text-text-2" role="status">{t('collectors.loading')}</p>
          ) : (
            <>
              <p className="mb-3 text-sm leading-5 text-text-2">{t('collectors.configNote')}</p>
              <CollectorBadges collectors={collectors.data ?? []} />
            </>
          )}
        </aside>
      </div>
      {adding && <SourceFormModal onClose={() => setAdding(false)} />}
    </>
  );
}
