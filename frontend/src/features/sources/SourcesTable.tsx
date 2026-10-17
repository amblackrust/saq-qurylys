import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCollectSourceNow, useUpdateSourceAccount } from '@/api/hooks/ads';
import { useObject } from '@/api/hooks/objects';
import type { CollectorStatus, SourceAccount } from '@/api/types';
import { Chip } from '@/components/Chip';
import { dataColumns } from '@/components/dataColumns';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isHttpUrl } from '@/features/ads/url';
import { usePagedRows } from '@/features/admin/usePagedRows';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';
import { useTerritoryList } from '@/lib/territories';
import { collectorOf, isCollectorOn } from './collectors';

const PAGE_SIZE = 50;
const col = dataColumns<SourceAccount>();

function BoundObject({ id }: { id: number | null }) {
  const object = useObject(id ?? 0, id !== null);
  if (id === null) return <span className="text-text-3">—</span>;
  return <Link className="text-link hover:underline" to={`/objects/${id}`}>{object.data ? `${object.data.code} · ${object.data.name}` : `#${id}`}</Link>;
}

interface Props {
  accounts: SourceAccount[];
  /** undefined while the states load: nothing can be collected yet */
  collectors: CollectorStatus[] | undefined;
}

export function SourcesTable({ accounts, collectors }: Props) {
  const { t } = useTranslation('sources');
  const { t: tCommon } = useTranslation();
  const e = useEnum();
  const { dateTime } = useFormat();
  const { territories } = useTerritoryList();
  const update = useUpdateSourceAccount();
  const collect = useCollectSourceNow();
  const { pageRows, pageIndex, setPageIndex } = usePagedRows(accounts, PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const from = accounts.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const to = Math.min(accounts.length, (pageIndex + 1) * PAGE_SIZE);
  const territoryNames = new Map(territories.map((territory) => [territory.id, territory.name]));

  const collectBlocker = (account: SourceAccount): string | null => {
    const source = collectorOf(account);
    if (source === null) return t('collectUnsupported');
    return collectors && isCollectorOn(source, collectors) ? null : t('collectOff');
  };

  const columns = [
    col.display({
      id: 'platform',
      header: t('columns.platform'),
      cell: ({ row }) => <Chip>{e('platform', row.original.platform)}</Chip>,
    }),
    col.display({
      id: 'source',
      header: t('columns.source'),
      cell: ({ row }) => {
        const { handle, url } = row.original;
        return (
          <div className="flex max-w-80 min-w-0 flex-col gap-0.5">
            <span className="font-mono text-sm [overflow-wrap:anywhere]">{handle}</span>
            {url &&
              (isHttpUrl(url) ? (
            <a className="truncate text-sm text-link hover:underline" href={url} target="_blank" rel="noopener noreferrer" title={url}>
                  {url}
                </a>
              ) : (
                <span className="truncate text-xs text-text-2">{url}</span>
              ))}
          </div>
        );
      },
    }),
    col.display({
      id: 'object',
      header: t('columns.object'),
      cell: ({ row }) => <BoundObject id={row.original.object_id} />,
    }),
    col.display({
      id: 'territory',
      header: t('columns.territory'),
      cell: ({ row }) => {
        const id = row.original.territory_id;
        return id === null ? '—' : (territoryNames.get(id) ?? `#${id}`);
      },
    }),
    col.display({
      id: 'watched',
      header: t('columns.watched'),
      cell: ({ row }) => (
        <Switch
          checked={row.original.is_watched}
          aria-label={t('watch', { name: row.original.handle })}
          disabled={update.isPending && update.variables?.id === row.original.id}
          onCheckedChange={(checked) => update.mutate({ id: row.original.id, data: { is_watched: checked } })}
        />
      ),
    }),
    col.display({
      id: 'lastCollected',
      header: t('columns.lastCollected'),
      cell: ({ row }) =>
        row.original.last_collected_at ? (
          <span className="tabular-nums">{dateTime(row.original.last_collected_at)}</span>
        ) : (
          <span className="text-text-3">{t('notCollected')}</span>
        ),
    }),
    col.display({
      id: 'lastError',
      header: t('columns.lastError'),
      cell: ({ row }) => {
        const { last_error: error, last_error_at: at } = row.original;
        if (!error) return <span className="text-text-3">—</span>;
        return (
          <div className="flex max-w-72 flex-col gap-0.5 text-sm">
            <strong className="font-medium text-zone-red-ink">{t('collectors.collectionFailed')}</strong>
            <span className="text-text-3 tabular-nums">{dateTime(at)}</span>
            <details className="text-sm text-text-2">
              <summary className="inline-flex cursor-pointer items-center max-sm:min-h-11">{t('collectors.errorDetails')}</summary>
              <span className="mt-1 block [overflow-wrap:anywhere]">{error}</span>
            </details>
          </div>
        );
      },
    }),
    col.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('collectNow')}</span>,
      cell: ({ row }) => {
        const blocker = collectBlocker(row.original);
        return (
          <div className="flex justify-end">
            <Tooltip>
              {/* A disabled button gets no pointer events, so the tooltip hangs on its wrapper. */}
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="max-sm:min-h-11"
                    disabled={blocker !== null}
                    loading={collect.isPending && collect.variables === row.original.id}
                    onClick={() => collect.mutate(row.original.id)}
                  >
                    <IconRefresh />
                    {t('collectNow')}
                  </Button>
                </span>
              </TooltipTrigger>
              {blocker !== null && <TooltipContent>{blocker}</TooltipContent>}
            </Tooltip>
          </div>
        );
      },
    }),
  ];

  return (
    <>
      <div className="hidden lg:block">
        <DataTable
          columns={columns}
          data={pageRows}
          total={accounts.length}
          pageIndex={pageIndex}
          pageSize={PAGE_SIZE}
          onPageChange={setPageIndex}
          getRowId={(account) => String(account.id)}
          emptyText={t('empty')}
        />
      </div>
      <div className="lg:hidden">
        {pageRows.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {pageRows.map((account) => {
              const blocker = collectBlocker(account);
              const territory = account.territory_id === null ? null : territoryNames.get(account.territory_id) ?? `#${account.territory_id}`;
              return (
                <li key={account.id} className="p-4">
                  <article className="min-w-0 space-y-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <Chip>{e('platform', account.platform)}</Chip>
                        <p className="m-0 break-words font-mono text-base font-medium text-text">{account.handle}</p>
                        {account.url && (isHttpUrl(account.url) ? (
                          <a className="block break-all text-sm text-link hover:underline" href={account.url} target="_blank" rel="noopener noreferrer">
                            {account.url}
                          </a>
                        ) : (
                          <p className="m-0 break-all text-sm text-text-2">{account.url}</p>
                        ))}
                      </div>
                      {account.object_id === null ? (
                        <span className="shrink-0 text-sm text-text-3">—</span>
                      ) : (
                        <BoundObject id={account.object_id} />
                      )}
                    </div>
                    {territory && <p className="m-0 text-sm text-text-2">{t('columns.territory')}: {territory}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <div className="min-w-0 text-sm text-text-2">
                        <span className="block">{t('columns.lastCollected')}</span>
                        <span className="tabular-nums">{account.last_collected_at ? dateTime(account.last_collected_at) : t('notCollected')}</span>
                        {account.last_error && (
                          <details className="mt-2 text-zone-red-ink">
                            <summary className="inline-flex min-h-11 cursor-pointer items-center">{t('collectors.collectionFailed')} · {t('collectors.errorDetails')}</summary>
                            <span className="block break-words text-text-2">{account.last_error}</span>
                          </details>
                        )}
                      </div>
                      <label className="flex min-h-11 items-center gap-2 text-sm text-text">
                        <Switch
                          checked={account.is_watched}
                          aria-label={t('watch', { name: account.handle })}
                          disabled={update.isPending && update.variables?.id === account.id}
                          onCheckedChange={(checked) => update.mutate({ id: account.id, data: { is_watched: checked } })}
                        />
                        {t('columns.watched')}
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="min-h-11"
                              disabled={blocker !== null}
                              loading={collect.isPending && collect.variables === account.id}
                              onClick={() => collect.mutate(account.id)}
                            >
                              <IconRefresh />
                              {t('collectNow')}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {blocker !== null && <TooltipContent>{blocker}</TooltipContent>}
                      </Tooltip>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 p-4 text-sm text-text-2">{t('empty')}</p>
        )}
        <footer className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm">
          <span className="text-text-2 tabular-nums">{tCommon('pagination.range', { from, to, total: accounts.length })}</span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2 text-text-2">
              <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label={tCommon('pagination.prev')} disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>
                <IconChevronLeft />
              </Button>
              <span className="tabular-nums">{tCommon('pagination.page', { page: pageIndex + 1, pages: pageCount })}</span>
              <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label={tCommon('pagination.next')} disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)}>
                <IconChevronRight />
              </Button>
            </div>
          )}
        </footer>
      </div>
    </>
  );
}
