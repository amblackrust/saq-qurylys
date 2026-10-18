import { useState } from 'react';
import { useDebouncedCallback } from '@/lib/hooks';
import { IconChevronRight, IconFileSpreadsheet, IconPlus, IconSearch, IconUpload } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { buildQuery, downloadFile } from '@/api/client';
import { errorMessage } from '@/api/queryClient';
import { useObjects } from '@/api/hooks/objects';
import type { ObjectRow } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { dataColumns } from '@/components/dataColumns';
import { DataTable } from '@/components/DataTable';
import { DemoBadge } from '@/components/DemoBadge';
import { ErrorBlock } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { formatApiDate } from '@/components/form/dates';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ZoneBadge, ZoneDot } from '@/components/Zone';
import { ZoneDisclaimer } from '@/components/ZoneDisclaimer';
import { toast } from '@/lib/toast';
import { useEnum, useKeyStatusLabel } from '@/i18n/useEnum';
import { ImportCsvModal } from './forms/ImportCsvModal';
import { ObjectFormModal } from './forms/ObjectFormModal';
import { ZONES, isZone, parseId, patchParams } from './list/filters';
import { TerritoryFilter } from './list/TerritoryFilter';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const col = dataColumns<ObjectRow>();

export function ObjectsPage() {
  const { t } = useTranslation('objects');
  const { t: common } = useTranslation();
  const e = useEnum();
  const keyStatus = useKeyStatusLabel();
  const navigate = useNavigate();
  const { canEditRegistry } = useAuth();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const q = params.get('q') ?? '';
  const zoneParam = params.get('zone');
  const zone = isZone(zoneParam) ? zoneParam : null;
  const territoryId = parseId(params.get('territory'));
  const districtId = parseId(params.get('district'));
  const pageIndex = (parseId(params.get('page')) ?? 1) - 1;
  const hasFilters = q !== '' || zone !== null || territoryId !== null || districtId !== null;

  // The input follows the URL (back/forward, reset) but keeps what is being typed until the debounce writes it.
  const [searchText, setSearchText] = useState(q);
  const [syncedQuery, setSyncedQuery] = useState(q);
  if (q !== syncedQuery) {
    setSyncedQuery(q);
    setSearchText(q);
  }
  const writeQuery = useDebouncedCallback((value: string) => {
    const next = value.trim();
    setSyncedQuery(next);
    setParams((prev) => patchParams(prev, { q: next || null, page: null }), { replace: true });
  }, SEARCH_DEBOUNCE_MS);

  const setFilters = (patch: Record<string, string | null>) =>
    setParams((prev) => patchParams(prev, { ...patch, page: null }));

  const filters = {
    zone: zone ?? undefined,
    territory_id: territoryId ?? undefined,
    district_id: districtId ?? undefined,
    q: q || undefined,
  };
  const query = useObjects({
    ...filters,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  });

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadFile(
        `/objects/export.xlsx${buildQuery(filters)}`,
        `AYQYN_${t('list.exportFilename')}_${formatApiDate(new Date())}.xlsx`,
      );
    } catch (error) {
      toast.error(errorMessage(error), { title: t('list.exportError') });
    } finally {
      setExporting(false);
    }
  };

  const columns = col.columns([
    col.accessor('name', {
      header: t('list.columns.name'),
      cell: (info) => (
        <span className="flex min-w-40 flex-col items-start gap-1">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/objects/${info.row.original.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold">
              {info.getValue()}
            </Link>
            {info.row.original.is_demo && <DemoBadge />}
          </span>
          <span className="text-sm text-text-2">{info.row.original.district_name ?? common('noValue')}</span>
        </span>
      ),
    }),
    col.accessor('code', {
      header: t('list.columns.code'),
      cell: (info) => <span className="whitespace-nowrap font-mono text-sm tabular-nums text-text-2">{info.getValue()}</span>,
    }),
    col.accessor('developer_name', {
      header: t('list.columns.developer'),
      cell: (info) => info.getValue() ?? common('noValue'),
    }),
    col.accessor('district_name', {
      header: t('list.columns.district'),
      cell: (info) => info.getValue() ?? common('noValue'),
    }),
    col.accessor('score', {
      header: t('list.columns.score'),
      cell: (info) => <span className="tabular-nums">{info.getValue() ?? common('noValue')}</span>,
    }),
    col.accessor('zone', {
      header: t('list.columns.zone'),
      cell: (info) => <ZoneBadge zone={info.getValue()} />,
    }),
    col.display({
      id: 'key_status',
      header: t('list.columns.reviewStatus'),
      cell: (info) => keyStatus(info.row.original.key_status, info.row.original.key_status_detail),
    }),
    col.display({
      id: 'open',
      header: () => <span className="sr-only">{common('open')}</span>,
      cell: (info) => (
        <Link
          to={`/objects/${info.row.original.id}`}
          onClick={(event) => event.stopPropagation()}
          aria-label={`${t('list.open')}: ${info.row.original.name}`}
          className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('list.open')}
          <IconChevronRight size={16} aria-hidden />
        </Link>
      ),
    }),
  ]);

  return (
    <>
      <PageHeader
        title={t('list.title')}
        actions={
          canEditRegistry && (
            <>
              <Button variant="secondary" loading={exporting} onClick={() => void exportExcel()}>
                <IconFileSpreadsheet />
                {t('list.exportExcel')}
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <IconUpload />
                {t('list.importCsv')}
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <IconPlus />
                {t('list.create')}
              </Button>
            </>
          )
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)]">
        <section aria-label={t('list.workspace.register')} className="order-2 min-w-0 overflow-hidden rounded-xl border border-border bg-surface lg:order-1">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <h2 className="mb-0 text-lg font-semibold">{t('list.workspace.register')}</h2>
            {query.data && <span className="text-sm tabular-nums text-text-2">{query.data.total}</span>}
          </div>
          {query.isError && !query.data ? (
            <ErrorBlock error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={query.data?.items ?? []}
              total={query.data?.total ?? 0}
              pageIndex={pageIndex}
              pageSize={PAGE_SIZE}
              onPageChange={(next) => setParams((prev) => patchParams(prev, { page: next === 0 ? null : String(next + 1) }))}
              onRowClick={(row) => void navigate(`/objects/${row.id}`)}
              getRowId={(row) => String(row.id)}
              loading={query.isPending}
              fetching={query.isFetching && !query.isPending}
              emptyText={<>{t('list.empty')}<br /><span className="text-text-2">{t('list.emptyHint')}</span></>}
            />
          )}
        </section>

        <aside className="order-1 flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:order-2" aria-label={t('list.workspace.filters')}>
          <div>
            <h2 className="mb-1 text-lg font-semibold">{t('list.workspace.filters')}</h2>
            <p className="mb-0 text-sm leading-5 text-text-2">{t('list.description')}</p>
          </div>
          <InputGroup>
            <InputGroupAddon><IconSearch /></InputGroupAddon>
            <InputGroupInput
              aria-label={t('list.search')}
              placeholder={t('list.search')}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.currentTarget.value);
                writeQuery(event.currentTarget.value);
              }}
            />
          </InputGroup>
          <TerritoryFilter
            territoryId={territoryId}
            districtId={districtId}
            onChange={({ territory, district }) =>
              setFilters({
                territory: territory === null ? null : String(territory),
                district: district === null ? null : String(district),
              })
            }
          />
          {hasFilters && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                writeQuery.cancel();
                setParams(new URLSearchParams());
              }}
            >
              {common('reset')}
            </Button>
          )}
          <ZoneDisclaimer />
          <details className="border-t border-border pt-3">
            <summary className="min-h-11 cursor-pointer py-2 font-medium text-text-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {t('list.technicalFilters')}
            </summary>
            <div className="pt-2">
              <ToggleGroup
                type="single"
                aria-label={t('list.zoneFilter')}
                value={zone ?? 'all'}
                onValueChange={(value) => value && setFilters({ zone: isZone(value) ? value : null })}
                className="w-full flex-wrap justify-start"
              >
                <ToggleGroupItem value="all">{common('all')}</ToggleGroupItem>
                {ZONES.map((item) => (
                  <ToggleGroupItem key={item} value={item}>
                    <ZoneDot zone={item} size={8} />
                    {e('zone', item)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </details>
        </aside>
      </div>
      {canEditRegistry && (
        <>
          <ObjectFormModal opened={createOpen} onClose={() => setCreateOpen(false)} />
          <ImportCsvModal opened={importOpen} onClose={() => setImportOpen(false)} kind="objects" />
        </>
      )}
    </>
  );
}
