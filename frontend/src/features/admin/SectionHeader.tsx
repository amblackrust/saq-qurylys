import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function SectionHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border pb-4">
      <div className="min-w-0 max-w-[78ch]">
        <h2 className="m-0 text-lg font-semibold tracking-tight text-text">{title}</h2>
        {description && <p className="mb-0 mt-1.5 text-sm leading-relaxed text-text-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
