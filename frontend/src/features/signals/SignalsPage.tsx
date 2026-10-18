import { useState } from 'react';
import { IconFileSpreadsheet, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { buildQuery, downloadFile } from '@/api/client';
import { useSignals } from '@/api/hooks/signals';
import { errorMessage } from '@/api/queryClient';
import type { SignalRow, SignalStatus } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { dataColumns } from '@/components/dataColumns';
import { DataTable } from '@/components/DataTable';
import { DemoBadge } from '@/components/DemoBadge';
import { ErrorBlock } from '@/components/QueryState';
import { ObjectSelect } from '@/components/ObjectSelect';
import { PageHeader } from '@/components/PageHeader';
import { ZoneBadge } from '@/components/Zone';
import { ZoneDisclaimer } from '@/components/ZoneDisclaimer';
import { Button } from '@/components/ui/button';
import { formatApiDate } from '@/components/form/dates';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';
import { toast } from '@/lib/toast';
import { PAGE_SIZE, SIGNAL_STATUSES } from './constants';
import { CreateSignalModal } from './CreateSignalModal';
import { DueInfo } from './DueInfo';
import { SignalStatusChip } from './SignalStatusChip';

function parseStatus(value: string | null): SignalStatus | undefined {
  return SIGNAL_STATUSES.find((status) => status === value);
}

function parsePositiveInt(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const col = dataColumns<SignalRow>();
const FILTER_STATUSES: SignalStatus[] = ['requires_confirmation', 'returned', 'responded', 'sent', 'closed'];
const STATUS_GROUPS = [
  { key: 'action', statuses: ['requires_confirmation', 'returned', 'responded'] as SignalStatus[] },
  { key: 'waiting', statuses: ['sent'] as SignalStatus[] },
  { key: 'history', statuses: ['closed'] as SignalStatus[] },
];
const RECIPIENT_STATUS_GROUPS = [
  { key: 'action', statuses: ['sent'] as SignalStatus[] },
  { key: 'answered', statuses: ['responded'] as SignalStatus[] },
  { key: 'history', statuses: ['closed'] as SignalStatus[] },
];

export function SignalsPage() {
  const { t } = useTranslation('signals');
  const { canManageSignals, isRecipient } = useAuth();
  const e = useEnum();
  const { dateTime } = useFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const status = parseStatus(params.get('status')) ?? (isRecipient && params.get('scope') !== 'all' ? 'sent' : undefined);
  // Recipients only see their own cards and cannot browse the registry, so the object filter is not offered to them.
  const objectId = isRecipient ? undefined : parsePositiveInt(params.get('object_id'));
  const pageIndex = (parsePositiveInt(params.get('page')) ?? 1) - 1;
  const hasFilters = status !== undefined || objectId !== undefined;
  const hasExplicitFilters = params.has('status') || objectId !== undefined;
  const returnTo = `/signals${location.search}`;
  const detailHref = (id: number) => `/signals/${id}?${new URLSearchParams({ returnTo }).toString()}`;

  const filters = { status, object_id: objectId };
  const query = useSignals({ ...filters, limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE });

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadFile(
        `/signals/export.xlsx${buildQuery(filters)}`,
        `SAQ_QURYLYS_${t('list.exportFilename')}_${formatApiDate(new Date())}.xlsx`,
      );
    } catch (error) {
      toast.error(errorMessage(error), { title: t('list.exportError') });
    } finally {
      setExporting(false);
    }
  };

  const setParam = (changes: Record<string, string | null>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const columns = col.columns([
    col.accessor('number', {
      header: t('list.columns.number'),
      cell: (info) => (
        <Link to={detailHref(info.row.original.id)} className="text-link hover:underline" onClick={(event) => event.stopPropagation()}>
          {info.getValue()}
        </Link>
      ),
    }),
    col.accessor('object_name', {
      header: t('list.columns.object'),
      cell: (info) => (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {info.getValue()}
          {info.row.original.is_demo && <DemoBadge />}
        </span>
      ),
    }),
    col.accessor('zone', {
      header: t('list.columns.zone'),
      cell: (info) => <ZoneBadge zone={info.getValue()} />,
    }),
    col.accessor('status', {
      header: t('list.columns.nextStep'),
      cell: (info) => {
        const rowStatus = info.getValue();
        const canAnswer =
          rowStatus === 'sent' &&
          (isRecipient || (canManageSignals && info.row.original.recipient === 'mio'));
        let nextStep: string;
        if (canAnswer) nextStep = t('list.next.recipient');
        else if (rowStatus === 'closed') nextStep = t('list.next.closed');
        else if (isRecipient && rowStatus === 'responded') nextStep = t('list.next.respondedRecipient');
        else if (isRecipient || !canManageSignals) nextStep = t('list.next.readOnly');
        else nextStep = t(`list.next.${rowStatus}`);
        return (
          <div className="flex min-w-36 flex-col items-start gap-1">
            <SignalStatusChip status={rowStatus} />
            <span className="text-sm text-text-2">{nextStep}</span>
          </div>
        );
      },
    }),
    col.accessor('recipient', {
      header: t('list.columns.recipient'),
      cell: (info) => e('recipient', info.getValue()) || '—',
    }),
    col.accessor('due_date', {
      header: t('list.columns.due'),
      cell: (info) => (
        <DueInfo
          dueDate={info.getValue()}
          status={info.row.original.status}
          isOverdue={info.row.original.is_overdue}
        />
      ),
    }),
    col.accessor('created_at', {
      header: t('list.columns.created'),
      cell: (info) => <span className="tabular-nums">{dateTime(info.getValue())}</span>,
    }),
  ]);

  let emptyText = t('list.empty.admin');
  if (hasFilters && !(isRecipient && status === 'sent' && params.get('scope') !== 'all')) emptyText = t('list.empty.filtered');
  else if (canManageSignals) emptyText = t('list.empty.manage');
  else if (isRecipient) emptyText = t('list.empty.recipient');

  const subtitle = isRecipient
    ? t('list.subtitleRecipient')
    : canManageSignals
      ? t('list.subtitleManage')
      : t('list.subtitleReadOnly');

  return (
    <>
      <PageHeader
        title={t('list.title')}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="secondary" loading={exporting} onClick={() => void exportExcel()}>
              <IconFileSpreadsheet />
              {t('list.exportExcel')}
            </Button>
            {canManageSignals && (
              <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
                <IconPlus />
                {t('list.create')}
              </Button>
            )}
          </>
        }
      />
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="grid min-w-0 content-start gap-5 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="mb-3 text-base font-semibold text-text">{t('list.filters.status')}</p>
          <div role="group" aria-label={t('list.filters.status')} className="flex flex-col gap-1">
            <Button
              variant={(isRecipient ? params.get('scope') === 'all' : status === undefined) ? 'default' : 'outline'}
              className="min-h-11 justify-start"
              aria-pressed={isRecipient ? params.get('scope') === 'all' : status === undefined}
              onClick={() => setParam({ status: null, scope: isRecipient ? 'all' : null, page: null })}
            >
              {t('list.filters.all')}
            </Button>
            {(isRecipient ? RECIPIENT_STATUS_GROUPS : canManageSignals ? STATUS_GROUPS : [{ key: 'overview', statuses: FILTER_STATUSES }]).map((group) => (
              <div key={group.key} className="grid gap-1.5">
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-text-3">{t(`list.filters.groups.${group.key}`)}</p>
                {group.statuses.map((filterStatus) => (
                  <Button
                    key={filterStatus}
                    variant={status === filterStatus ? 'default' : 'outline'}
                    className="min-h-11 justify-start"
                    aria-pressed={status === filterStatus}
                    onClick={() => setParam({ status: filterStatus, scope: null, page: null })}
                  >
                    {t(`statusLabels.${filterStatus}`)}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>
        {isRecipient ? (
          hasExplicitFilters && (
            <div>
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => setParam({ status: null, scope: null, object_id: null, page: null })}
              >
                {t('list.filters.clear')}
              </Button>
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <ObjectSelect
              label={t('list.filters.object')}
              placeholder={t('list.filters.objectPlaceholder')}
              value={objectId ?? null}
              onChange={(next) => setParam({ object_id: next === null ? null : String(next), page: null })}
            />
            {hasFilters && (
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => setParam({ status: null, object_id: null, page: null })}
              >
                {t('list.filters.clear')}
              </Button>
            )}
          </div>
        )}
      </aside>
      <div className="min-w-0">
      {query.isError && !query.data ? (
        <ErrorBlock error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          total={query.data?.total ?? 0}
          pageIndex={pageIndex}
          pageSize={PAGE_SIZE}
          onPageChange={(next) => setParam({ page: next === 0 ? null : String(next + 1) })}
          onRowClick={(row) => void navigate(detailHref(row.id))}
          getRowId={(row) => String(row.id)}
          loading={query.isPending}
          fetching={query.isFetching}
          emptyText={emptyText}
        />
      )}
      </div>
      </div>
      <ZoneDisclaimer className="mt-3" />
      <CreateSignalModal opened={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
