import { useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useDashboard } from '@/api/hooks/objects';
import { useAssignments } from '@/api/hooks/assignments';
import { useSignals } from '@/api/hooks/signals';
import type { SignalRow, SignalStatus } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { ErrorBlock, LoadingBlock } from '@/components/QueryState';
import { ReportCard } from './ReportCard';
import { MyAssignments } from './MyAssignments';
import { AdminOverview } from './AdminOverview';

type QueueStatus = Exclude<SignalStatus, 'closed'>;
type SignalQuery = ReturnType<typeof useSignals>;

interface Queue {
  status: QueueStatus;
  title: string;
  actionLabel: string;
  query: SignalQuery;
}

function formatDate(value: string, language: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat(language === 'kk' ? 'kk-KZ' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function SignalLink({ row, language }: { row: SignalRow; language: string }) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/signals/${row.id}`}
      aria-label={`${t('work.openCard')}: ${row.number}, ${row.object_name}`}
      className="flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base text-text no-underline transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="min-w-0">
        <span className="block font-semibold tabular-nums">{row.number}</span>
        <span className="mt-0.5 block truncate text-sm text-text-2">{row.object_name}</span>
      </span>
      <span className="flex flex-none items-center gap-2 text-right text-sm">
        {row.is_overdue ? (
          <span className="text-zone-red-ink">{t('work.overdue')}</span>
        ) : row.due_date ? (
          <span className="text-text-3">{t('work.dueDate', { value: formatDate(row.due_date, language) })}</span>
        ) : null}
        <IconChevronRight className="size-4 text-text-3" aria-hidden />
      </span>
    </Link>
  );
}

export function WorkPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminOverview /> : <MioWorkPage />;
}

function MioWorkPage() {
  const { t, i18n } = useTranslation();
  const { canEditRegistry } = useAuth();
  const [requestedStatus, setRequestedStatus] = useState<QueueStatus | null>(null);
  const assignments = useAssignments({ mine: true, status: 'open', limit: 5 });
  const returned = useSignals({ status: 'returned', limit: 3 });
  const requiresConfirmation = useSignals({ status: 'requires_confirmation', limit: 3 });
  const responded = useSignals({ status: 'responded', limit: 3 });
  const sent = useSignals({ status: 'sent', limit: 3 });
  const dashboard = useDashboard({});

  const queues: Queue[] = [
    { status: 'returned', title: t('work.queueReturned'), actionLabel: 'work.primaryReturned', query: returned },
    {
      status: 'requires_confirmation',
      title: t('work.queueConfirmation'),
      actionLabel: 'work.primaryConfirmation',
      query: requiresConfirmation,
    },
    { status: 'responded', title: t('work.queueResponded'), actionLabel: 'work.primaryResponded', query: responded },
    { status: 'sent', title: t('work.queueSent'), actionLabel: 'work.primarySent', query: sent },
  ];
  const failedQueues = queues.filter(({ query }) => query.isError);
  const loadingQueues = queues.some(({ query }) => query.isPending || query.isFetching);
  const visibleQueues = queues.filter(
    ({ query }) => query.isPending || query.isFetching || query.isError || (query.data?.total ?? 0) > 0,
  );
  const allQueuesEmpty =
    !loadingQueues &&
    failedQueues.length === 0 &&
    queues.every(({ query }) => query.data?.total === 0);
  const primaryQueue =
    queues.find(({ status, query }) => !query.isError && (status === 'returned' || status === 'responded') && (query.data?.total ?? 0) > 0) ??
    queues.find(({ status, query }) => !query.isError && status === 'requires_confirmation' && (query.data?.total ?? 0) > 0) ??
    queues.find(({ status, query }) => !query.isError && status === 'sent' && (query.data?.total ?? 0) > 0);
  const selectedQueue =
    visibleQueues.find(({ status }) => status === requestedStatus) ??
    (primaryQueue && visibleQueues.find(({ status }) => status === primaryQueue.status)) ??
    visibleQueues[0];
  const primarySignal =
    primaryQueue?.status === 'sent'
      ? primaryQueue.query.data?.items.find((row) => row.recipient === 'mio') ?? primaryQueue.query.data?.items[0]
      : primaryQueue?.query.data?.items[0];
  const availableAssignments = assignments.isError ? undefined : assignments.data?.items;
  const overdueAssignment = availableAssignments?.find((item) => item.is_overdue);
  const primaryHref = overdueAssignment
    ? `/objects/${overdueAssignment.object.id}?assignment=${overdueAssignment.id}#assignments`
    : primaryQueue
      ? primarySignal
        ? `/signals/${primarySignal.id}`
        : `/signals?status=${primaryQueue.status}`
      : availableAssignments?.[0]
        ? `/objects/${availableAssignments[0].object.id}?assignment=${availableAssignments[0].id}#assignments`
        : allQueuesEmpty && !assignments.isPending && !assignments.isError
        ? '/ads?queue=true'
        : undefined;
  const primaryLabel = overdueAssignment
    ? t('work.primaryAssignment', { object: overdueAssignment.object.name })
    : primaryQueue
      ? primarySignal
        ? t(
            primaryQueue.status === 'sent' && primarySignal.recipient === 'mio'
              ? 'work.primarySentMio'
              : primaryQueue.actionLabel,
            { number: primarySignal.number },
          )
        : t('work.openAll')
      : availableAssignments?.[0]
        ? t('work.primaryAssignment', { object: availableAssignments[0].object.name })
        : allQueuesEmpty && !assignments.isPending && !assignments.isError
        ? t('work.checkAds')
        : undefined;
  const redObjects = dashboard.data?.objects.filter((object) => object.zone === 'red').slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl space-y-1.5">
          <h1>{t('work.title')}</h1>
          <p className="m-0 max-w-2xl text-base leading-6 text-text-2">
            {t('work.intro')}
          </p>
        </div>
        {primaryHref && primaryLabel && (
          <Link
            to={primaryHref}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground no-underline transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-focus"
          >
            {primaryLabel}
          </Link>
        )}
        {primaryHref !== '/ads?queue=true' && (
          <Link to="/ads?queue=true" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">
            {t('work.adsQueueLink')}
          </Link>
        )}
      </header>

      {canEditRegistry && <MyAssignments query={assignments} />}

      <div className="space-y-6">
        <section aria-labelledby="work-queues-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-border pb-3">
            <h2 id="work-queues-title" className="mb-0 text-xl font-semibold">
              {t('work.queuesTitle')}
            </h2>
          </div>
          <p className="mb-3 -mt-1 text-sm text-text-2">{t('work.territorialQueueNote')}</p>
          {selectedQueue ? (
            <div className="grid min-w-0 items-start overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[16rem_minmax(0,1fr)]">
              <nav aria-label={t('work.queuesTitle')} className="grid grid-cols-1 gap-2 border-b border-border p-2 sm:grid-cols-2 sm:p-3 lg:grid-cols-1 lg:gap-1 lg:border-r lg:border-b-0">
                {visibleQueues.map(({ status, title, query }) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selectedQueue.status === status}
                    onClick={() => setRequestedStatus(status)}
                    className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selectedQueue.status === status ? 'bg-hover text-text' : 'text-text-2'}`}
                  >
                    <span className="min-w-0 whitespace-normal">{title}</span>
                    <span className="shrink-0 tabular-nums text-text-3">
                      {query.data ? query.data.total : query.isError ? '!' : '—'}
                    </span>
                  </button>
                ))}
              </nav>
              <div className="min-w-0 px-4 sm:px-5" aria-live="polite">
                {selectedQueue.query.isError ? (
                  <ErrorBlock error={selectedQueue.query.error} onRetry={() => void selectedQueue.query.refetch()} />
                ) : selectedQueue.query.isPending || selectedQueue.query.isFetching ? (
                  <LoadingBlock label={t('work.loadingSignals')} />
                ) : (
                  <>
                    <ul className="m-0 list-none divide-y divide-border p-0">
                      {selectedQueue.query.data?.items.map((row) => (
                        <li key={row.id}>
                          <SignalLink row={row} language={i18n.resolvedLanguage ?? i18n.language} />
                        </li>
                      ))}
                    </ul>
                    {(selectedQueue.query.data?.total ?? 0) > (selectedQueue.query.data?.items.length ?? 0) && (
                      <Link
                        to={`/signals?status=${selectedQueue.status}`}
                        className="my-2 inline-flex min-h-11 items-center px-2 text-sm text-link hover:underline"
                      >
                        {t('work.openAll')}
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <p className="m-0 text-sm text-text-2">{t('work.emptyQueue')}</p>
              <Link to="/signals" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">
                {t('work.openAll')}
              </Link>
            </div>
          )}
        </section>

        <section className="min-w-0" aria-labelledby="work-red-objects-title">
          <div className="border-b border-border pb-3">
            <h2 id="work-red-objects-title" className="mb-0 text-xl font-semibold">
              {t('work.redObjectsTitle')}
            </h2>
            <p className="mb-0 mt-1.5 text-sm leading-5 text-text-2">{t('work.redObjectsNote')}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface px-3 sm:px-4">
            {dashboard.isError ? (
              <ErrorBlock error={dashboard.error} onRetry={() => void dashboard.refetch()} />
            ) : dashboard.isPending ? (
              <LoadingBlock label={t('work.loadingDashboard')} />
            ) : redObjects.length > 0 ? (
              <ul className="m-0 grid list-none gap-x-4 divide-y divide-border p-0 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
                {redObjects.map((object) => (
                  <li key={object.id} className="border-border sm:border-t">
                    <Link
                      to={`/objects/${object.id}`}
                      className="flex min-h-14 items-center justify-between gap-3 py-2.5 text-base text-text no-underline hover:text-accent-text focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <span className="min-w-0 truncate">{object.name}</span>
                      <IconChevronRight className="size-4 flex-none text-text-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="my-3 text-sm text-text-2">{t('work.noRedObjects')}</p>
            )}
          </div>

          <Link to="/objects" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">
            {t('work.openObjects')}
          </Link>
        </section>
      </div>
      <details className="rounded-xl border border-border bg-surface px-4 py-3">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">{t('work.openReport')}</summary>
        <div className="pt-3"><ReportCard /></div>
      </details>
    </div>
  );
}
