import { useState } from 'react';
import { IconArrowUpRight, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useDashboard } from '@/api/hooks/objects';
import { useAssignments } from '@/api/hooks/assignments';
import { useSignals } from '@/api/hooks/signals';
import type { SignalRow, SignalStatus } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { ErrorBlock, LoadingBlock } from '@/components/QueryState';
import { ZoneBadge } from '@/components/Zone';
import { ReportCard } from './ReportCard';
import { MyAssignments } from './MyAssignments';
import { AdminOverview } from './AdminOverview';
import './work.css';

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
      className="work-signal-link flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base text-text no-underline transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus"
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
  const assignmentState = assignments.isPending
    ? 'loading'
    : assignments.isError
      ? 'error'
      : (assignments.data?.items.length ?? 0) > 0
        ? 'has-items'
        : 'empty';
  const hasAssignmentCard = canEditRegistry && assignmentState === 'has-items';
  const showInlineAssignmentStatus = canEditRegistry && !hasAssignmentCard;

  return (
    <div
      className={`work-page ${hasAssignmentCard ? 'work-page--has-assignments' : 'work-page--compact'} ${primaryHref === '/ads?queue=true' ? 'work-page--no-ads' : ''}`}
    >
      <header className="work-page__intro">
        <div className="work-page__intro-copy">
          <h1>{t('work.title')}</h1>
          <p className="m-0 max-w-3xl text-base leading-6 text-text-2">{t('work.intro')}</p>
        </div>
      </header>

      <section className="work-card work-card--next" aria-labelledby="work-next-title" data-testid="work-next-card">
        <h2 id="work-next-title">{t('work.nextActionTitle')}</h2>
        <div className="work-next__content">
          {primaryHref && primaryLabel ? (
            <Link
              to={primaryHref}
              data-testid="work-primary-action"
              className="work-next__action inline-flex min-h-12 items-center justify-between gap-4 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground no-underline transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span>{primaryLabel}</span>
              <IconArrowUpRight className="size-5 flex-none" aria-hidden />
            </Link>
          ) : assignments.isError && !canEditRegistry ? (
            <ErrorBlock error={assignments.error} onRetry={() => void assignments.refetch()} />
          ) : failedQueues[0] ? (
            <ErrorBlock error={failedQueues[0].query.error} onRetry={() => void failedQueues[0].query.refetch()} />
          ) : assignments.isPending && !canEditRegistry ? (
            <LoadingBlock label={t('work.loadingAssignments')} />
          ) : loadingQueues ? (
            <LoadingBlock label={t('work.loadingSignals')} />
          ) : assignments.isError ? null : (
            <p className="work-next__empty">{t('work.emptyQueue')}</p>
          )}
        </div>
        {showInlineAssignmentStatus && (
          <div
            className="work-assignments-status"
            data-assignment-state={assignmentState}
            data-testid="work-assignments-card"
          >
            <MyAssignments query={assignments} />
          </div>
        )}
      </section>

      {hasAssignmentCard && (
        <div
          className="work-card work-card--assignments"
          data-assignment-state={assignmentState}
          data-testid="work-assignments-card"
        >
          <MyAssignments query={assignments} />
        </div>
      )}

      <section className="work-card work-card--signals" aria-labelledby="work-queues-title" data-testid="work-signals-card">
        <header className="work-card__heading">
          <h2 id="work-queues-title">{t('work.queuesTitle')}</h2>
          <p className="m-0 text-sm leading-5 text-text-2">{t('work.territorialQueueNote')}</p>
        </header>
        {selectedQueue ? (
          <div className="work-signals__layout">
            <nav aria-label={t('work.queuesTitle')} className="work-signals__tabs">
              {visibleQueues.map(({ status, title, query }) => (
                <button
                  key={status}
                  type="button"
                  data-testid={`work-signal-status-${status}`}
                  aria-pressed={selectedQueue.status === status}
                  onClick={() => setRequestedStatus(status)}
                  className={`work-signals__tab flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selectedQueue.status === status ? 'is-selected' : ''}`}
                >
                  <span className="min-w-0 whitespace-normal">{title}</span>
                  <span className="shrink-0 tabular-nums" aria-label={query.isError ? t('states.loadError') : undefined}>
                    {query.data ? query.data.total : query.isError ? '!' : '—'}
                  </span>
                </button>
              ))}
            </nav>
            <div
              className="work-signals__items min-w-0"
              data-testid="work-signal-details"
              aria-live="polite"
              aria-busy={selectedQueue.query.isPending || selectedQueue.query.isFetching}
            >
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
          <div className="work-signals__empty">
            <p className="m-0 text-sm text-text-2">{t('work.emptyQueue')}</p>
            <Link to="/signals" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">
              {t('work.openAll')}
            </Link>
          </div>
        )}
      </section>

      <section className="work-card work-card--objects" aria-labelledby="work-red-objects-title" data-testid="work-objects-card">
        <header className="work-card__heading">
          <h2 id="work-red-objects-title">{t('work.redObjectsTitle')}</h2>
          <p className="m-0 text-sm leading-5 text-text-2">{t('work.redObjectsNote')}</p>
        </header>
        <div className="work-objects__list">
          {dashboard.isError ? (
            <ErrorBlock error={dashboard.error} onRetry={() => void dashboard.refetch()} />
          ) : dashboard.isPending ? (
            <LoadingBlock label={t('work.loadingDashboard')} />
          ) : redObjects.length > 0 ? (
            <ul className="m-0 grid list-none gap-x-4 divide-y divide-border p-0">
              {redObjects.map((object) => (
                <li key={object.id} className="border-border">
                  <Link
                    to={`/objects/${object.id}`}
                    className="work-object-link flex min-h-14 items-center justify-between gap-3 py-2.5 text-base text-text no-underline focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{object.name}</span>
                      <ZoneBadge zone={object.zone} />
                    </span>
                    <IconChevronRight className="size-4 flex-none text-text-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="my-3 text-sm text-text-2">{t('work.noRedObjects')}</p>
          )}
        </div>
        <Link to="/objects" className="work-card__text-link inline-flex min-h-11 items-center text-sm hover:underline">
          {t('work.openObjects')}
        </Link>
      </section>

      {primaryHref !== '/ads?queue=true' && (
        <section className="work-card work-card--ads" aria-labelledby="work-ads-title" data-testid="work-ads-card">
          <p className="work-card__eyebrow">{t('work.adsQueueLink')}</p>
          <h2 id="work-ads-title">{t('nav.ads')}</h2>
          <p className="m-0 text-base leading-6">{t('ads:subtitle')}</p>
          <Link
            to="/ads?queue=true"
            className="work-ads__action inline-flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 text-base font-semibold no-underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span>{t('work.adsQueueLink')}</span>
            <IconArrowUpRight className="size-5 flex-none" aria-hidden />
          </Link>
        </section>
      )}

      <details className="work-card work-card--report" data-testid="work-report-card">
        <summary className="work-report__summary">
          <span>{t('work.openReport')}</span>
          <IconChevronDown className="work-report__chevron size-5 flex-none" aria-hidden />
        </summary>
        <div className="work-report__content"><ReportCard /></div>
      </details>
    </div>
  );
}
