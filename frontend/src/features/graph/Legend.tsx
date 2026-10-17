import { useTranslation } from 'react-i18next';
import type { GraphNodeType } from '@/api/types';

const TYPES: readonly GraphNodeType[] = ['developer', 'object', 'phone', 'account', 'ad'];

// Same shapes and colors as the canvas (LinkGraphCanvas, palette.ts), drawn with the theme variables.
function Swatch({ type }: { type: GraphNodeType }) {
  return (
    <svg className="size-3.5 flex-none" viewBox="-9 -9 18 18" aria-hidden>
      {type === 'developer' && <rect x="-7" y="-7" width="14" height="14" rx="4" fill="var(--graph-developer)" />}
      {type === 'object' && <circle r="7" fill="var(--zone-none)" />}
      {type === 'phone' && <path d="M0 -7 L7 0 L0 7 L-7 0 Z" fill="var(--text-2)" />}
      {type === 'account' && <path d="M0 -7 L6.6 5 L-6.6 5 Z" fill="var(--text-3)" />}
      {type === 'ad' && <circle r="3.5" fill="var(--text-disabled)" />}
    </svg>
  );
}

export function Legend() {
  const { t } = useTranslation('graph');
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-1.5 p-0" aria-label={t('legend.label')}>
      {TYPES.map((type) => (
        <li
          key={type}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 text-sm font-medium text-text-2"
        >
          <Swatch type={type} />
          {t(`legend.${type}`)}
          {type === 'object' && (
            <span className="inline-flex gap-0.5" aria-hidden>
              {(['green', 'yellow', 'red'] as const).map((zone) => (
                <span key={zone} className="size-2 rounded-full" style={{ background: `var(--zone-${zone})` }} />
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
