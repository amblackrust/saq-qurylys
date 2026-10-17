import { useTranslation } from 'react-i18next';
import { useAcceptSuggestion, useDismissSuggestion, useSourceSuggestions } from '@/api/hooks/graph';
import type { SourceSuggestion } from '@/api/types';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/ui/button';
import { QueryBoundary } from '@/components/QueryState';
import { useEnum } from '@/i18n/useEnum';
import { useFormat } from '@/i18n/useFormat';

export function SuggestionsPanel() {
  const { t } = useTranslation('graph');
  const e = useEnum();
  const { date } = useFormat();
  const suggestions = useSourceSuggestions();
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();

  const accepting = accept.isPending ? accept.variables : undefined;
  const dismissing = dismiss.isPending ? dismiss.variables : undefined;
  const isSame = (item: SourceSuggestion, other?: Pick<SourceSuggestion, 'platform' | 'handle'>) =>
    other?.platform === item.platform && other.handle === item.handle;

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface shadow-1 dark:shadow-none">
      <header className="flex items-center border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold">{t('suggestions.title')}</h3>
      </header>
      <div className="p-3">
        <p className="mb-3 text-sm text-text-3">{t('suggestions.hint')}</p>
        <QueryBoundary query={suggestions}>
          {(items) =>
            items.length === 0 ? (
              <p className="text-sm text-text-2">{t('suggestions.empty')}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((item) => (
                  <li key={`${item.platform}:${item.handle}`} className="grid gap-2 rounded-xl border border-border bg-surface-raised px-3 py-3">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <a
                        className="min-w-0 text-sm font-semibold wrap-anywhere text-link hover:underline"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={t('suggestions.openProfile', { handle: item.handle })}
                      >
                        @{item.handle}
                      </a>
                      <Chip>{e('platform', item.platform)}</Chip>
                    </div>
                    <p className="m-0 text-sm text-text-3">
                      {t('suggestions.posts', { count: item.posts_count })} · {t('suggestions.lastSeen', { value: date(item.last_seen_at) })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        loading={isSame(item, accepting)}
                        disabled={isSame(item, dismissing)}
                        onClick={() => accept.mutate(item)}
                      >
                        {t('suggestions.accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={isSame(item, dismissing)}
                        disabled={isSame(item, accepting)}
                        onClick={() => dismiss.mutate({ platform: item.platform, handle: item.handle })}
                      >
                        {t('suggestions.dismiss')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
    </section>
  );
}
