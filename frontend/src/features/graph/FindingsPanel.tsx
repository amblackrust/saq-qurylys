import { useTranslation } from 'react-i18next';
import type { GraphFinding, GraphNode } from '@/api/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { findingNodeId, formatPhone } from './graphModel';

interface Props {
  findings: GraphFinding[];
  nodes: GraphNode[];
  /** index of the finding that is shown on the graph */
  active: number | null;
  onSelect: (index: number | null) => void;
}

export function FindingsPanel({ findings, nodes, active, onSelect }: Props) {
  const { t } = useTranslation('graph');
  const labels = new Map(nodes.map((node) => [node.id, node.label]));

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface shadow-1 dark:shadow-none">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold">{t('findings.title')}</h3>
        {active !== null && (
          <Button variant="ghost" size="xs" onClick={() => onSelect(null)}>
            {t('findings.clear')}
          </Button>
        )}
      </header>
      <div className="p-4">
        <p className="mb-3 text-sm text-text-3">{t('findings.hint')}</p>
        {findings.length === 0 ? (
          <p className="text-sm text-text-2">{t('findings.empty')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {findings.map((finding, index) => {
              const label = labels.get(findingNodeId(finding)) ?? finding.value;
              return (
                <li key={findingNodeId(finding)}>
                  <button
                    type="button"
                    className={cn(
                      'grid w-full cursor-pointer gap-1 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-left outline-none transition-[background-color,box-shadow,border-color] duration-(--dur) hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus',
                      'aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary',
                    )}
                    aria-pressed={active === index}
                    onClick={() => onSelect(active === index ? null : index)}
                  >
                    <span className="text-sm font-semibold">
                      {t(`findings.${finding.kind}`, { count: finding.developer_ids.length, defaultValue: finding.label })}
                    </span>
                    <span className="font-mono text-sm break-words text-text-2 tabular-nums">
                      {finding.kind === 'shared_phone' ? formatPhone(finding.value) : label}
                    </span>
                    <span className="text-xs text-text-3">{t('findings.objects', { count: finding.object_ids.length })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
