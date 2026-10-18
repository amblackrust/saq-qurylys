import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCollectors, useSourceAccounts } from '@/api/hooks/ads';
import { ErrorBlock, LoadingBlock } from '@/components/QueryState';

const managementSections = ['users', 'territories', 'phrases', 'factors', 'holidays', 'settings', 'registry'] as const;

export function AdminOverview() {
  const { t } = useTranslation();
  const { t: ta } = useTranslation('admin');
  const accounts = useSourceAccounts();
  const collectors = useCollectors();
  const collectorStats = collectors.data?.reduce(
    (stats, collector) => {
      const sources = Object.values(collector.sources);
      if (sources.length > 0) {
        return {
          enabled: stats.enabled + sources.filter(Boolean).length,
          total: stats.total + sources.length,
        };
      }
      return { enabled: stats.enabled + Number(collector.enabled), total: stats.total + 1 };
    },
    { enabled: 0, total: 0 },
  );
  const accountErrors = accounts.data?.filter((account) => account.last_error).length;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-1.5">
        <h1>{t('work.adminTitle')}</h1>
        <p className="m-0 text-base leading-6 text-text-2">{t('work.adminIntro')}</p>
      </header>

      <section className="space-y-3" aria-labelledby="admin-health-title">
        <div className="border-b border-border pb-3">
          <h2 id="admin-health-title" className="mb-0 text-xl font-semibold">{t('work.adminSourcesTitle')}</h2>
          <p className="mb-0 mt-1.5 text-sm leading-5 text-text-2">{t('work.adminSourcesNote')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-border bg-surface p-4" aria-label={t('work.adminAccountsTitle')}>
            <h3 className="mb-2 text-base font-semibold">{t('work.adminAccountsTitle')}</h3>
            {accounts.isError ? (
              <ErrorBlock error={accounts.error} onRetry={() => void accounts.refetch()} />
            ) : accounts.isPending ? (
              <LoadingBlock />
            ) : (
              <>
                <p className="m-0 text-sm text-text-2">
                  {t('work.adminAccountsCount', { count: accounts.data.length })}
                </p>
                <p className="mb-0 mt-1 text-sm text-text-2">
                  {t('work.adminAccountErrors', { count: accountErrors ?? 0 })}
                </p>
              </>
            )}
            <Link to="/sources" className="mt-2 inline-flex min-h-11 items-center text-sm text-link hover:underline">
              {t('work.adminOpenSources')}
            </Link>
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-surface p-4" aria-label={t('work.adminCollectorsTitle')}>
            <h3 className="mb-2 text-base font-semibold">{t('work.adminCollectorsTitle')}</h3>
            {collectors.isError ? (
              <ErrorBlock error={collectors.error} onRetry={() => void collectors.refetch()} />
            ) : collectors.isPending ? (
              <LoadingBlock />
            ) : (
              <p className="m-0 text-sm text-text-2">
                {t('work.adminCollectorsCount', { enabled: collectorStats?.enabled ?? 0, total: collectorStats?.total ?? 0 })}
              </p>
            )}
          </section>
        </div>
      </section>

      <section aria-labelledby="admin-management-title">
        <div className="mb-3 border-b border-border pb-3">
          <h2 id="admin-management-title" className="mb-0 text-xl font-semibold">{t('work.adminManagementTitle')}</h2>
        </div>
        <ul className="m-0 grid list-none gap-x-4 divide-y divide-border rounded-xl border border-border bg-surface px-4 p-0 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
          {managementSections.map((section) => (
            <li key={section} className="border-border sm:border-t">
              <Link
                to={`/admin/${section}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2.5 text-base text-text no-underline hover:text-accent-text focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span>{ta(`sections.${section}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-data-title">
        <div className="mb-3 border-b border-border pb-3">
          <h2 id="admin-data-title" className="mb-0 text-xl font-semibold">{t('work.adminDataTitle')}</h2>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Link to="/ads" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">{t('nav.ads')}</Link>
          <Link to="/objects" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">{t('nav.objects')}</Link>
          <Link to="/signals" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">{t('nav.signals')}</Link>
          <Link to="/map" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">{t('nav.map')}</Link>
          <Link to="/graph" className="inline-flex min-h-11 items-center text-sm text-link hover:underline">{t('nav.graph')}</Link>
        </div>
      </section>
    </div>
  );
}
