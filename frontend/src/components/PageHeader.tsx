import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-text max-sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-base text-text-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
