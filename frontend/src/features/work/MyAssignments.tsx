import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAssignments } from '@/api/hooks/assignments';
import { ErrorBlock, LoadingBlock } from '@/components/QueryState';
import { AssignmentActions } from '@/features/assignments/AssignmentActions';
import { AssignmentState } from '@/features/assignments/AssignmentState';
import { useFormat } from '@/i18n/useFormat';

const SHOWN = 5;

/** Open assignments given to the current user, overdue first. */
export function MyAssignments({ query }: { query: ReturnType<typeof useAssignments> }) {
  const { t } = useTranslation('assignments');
  const { date } = useFormat();

  if (query.isPending) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data?.items.length === 0) return <p className="m-0 text-sm text-text-3" role="status">{t('mine.empty')}</p>;

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
      aria-labelledby="my-assignments-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="my-assignments-title" className="text-lg font-semibold">
          {t('mine.title')}
        </h2>
        <Link
          to="/control"
          className="inline-flex min-h-11 items-center text-sm text-link hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t('mine.all')}
        </Link>
      </div>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {query.data.items.map((item) => (
          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link to={`/objects/${item.object.id}?assignment=${item.id}#assignments`} className="font-semibold">
                {item.object.name}
              </Link>
              <AssignmentState assignment={item} />
              <span className="text-sm text-text-2">
                {t('section.due')}: <span className="tabular-nums">{date(item.due_date)}</span>
              </span>
            </div>
            <p className="m-0 mt-1 text-sm [overflow-wrap:anywhere]">{item.task}</p>
            <AssignmentActions assignment={item} />
          </li>
        ))}
      </ul>
      {query.data && query.data.total > SHOWN && (
        <p className="m-0 mt-2 text-xs text-text-3">{t('mine.more', { shown: SHOWN, total: query.data.total })}</p>
      )}
    </section>
  );
}
