import { Navigate, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import { NavigationTile } from './NavigationTile';
import type { NavigationEntry, NavigationGroup } from './model';

export interface NavigationOutletContext {
  entries: NavigationEntry[];
  group?: NavigationGroup;
}

export function NavigationGroupPage() {
  const { t } = useTranslation();
  const { group } = useOutletContext<NavigationOutletContext>();

  if (!group) return <Navigate to="/home" replace />;

  return (
    <section aria-label={group.label}>
      <h1 className="text-2xl leading-tight font-medium tracking-[-0.035em] text-text sm:text-3xl">{group.label}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-2 sm:text-base">{group.purpose}</p>
      <nav id="bento-leaf-navigation" aria-label={t('nav.groupNavigation', { group: group.label })} className="mt-5 grid grid-cols-12 gap-[clamp(.4rem,.55vw,.65rem)]">
        {group.items.map((item, index) => (
          <NavigationTile
            key={item.id}
            item={item}
            mode="home"
            testId={`bento-leaf-card-${item.id}`}
            className={index === 0 ? 'col-span-12 sm:col-span-6 lg:col-span-7' : 'col-span-12 sm:col-span-6 lg:col-span-5'}
          />
        ))}
      </nav>
    </section>
  );
}
