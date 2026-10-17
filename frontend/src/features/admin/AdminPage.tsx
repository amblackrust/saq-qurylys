import type { ComponentType } from 'react';
import {
  IconChevronRight,
  IconAdjustmentsHorizontal,
  IconBook2,
  IconCalendarEvent,
  IconDatabaseImport,
  IconMap2,
  IconSettings,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import { Navigate, NavLink, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { FactorsSection } from './FactorsSection';
import { HolidaysSection } from './HolidaysSection';
import { PhrasesSection } from './PhrasesSection';
import { RegistrySection } from './RegistrySection';
import { SettingsSection } from './SettingsSection';
import { TerritoriesSection } from './TerritoriesSection';
import { UsersSection } from './UsersSection';
import { ADMIN_SECTIONS, DEFAULT_SECTION, isAdminSection, type AdminSection } from './sections';

const SECTION_VIEWS: Record<AdminSection, ComponentType> = {
  users: UsersSection,
  factors: FactorsSection,
  phrases: PhrasesSection,
  holidays: HolidaysSection,
  settings: SettingsSection,
  territories: TerritoriesSection,
  registry: RegistrySection,
};

const SECTION_ICONS: Record<AdminSection, Icon> = {
  users: IconUsers,
  factors: IconAdjustmentsHorizontal,
  phrases: IconBook2,
  holidays: IconCalendarEvent,
  settings: IconSettings,
  territories: IconMap2,
  registry: IconDatabaseImport,
};

export function AdminPage() {
  const { t } = useTranslation('admin');
  const { section } = useParams();

  if (!isAdminSection(section)) return <Navigate to={`/admin/${DEFAULT_SECTION}`} replace />;
  const SectionView = SECTION_VIEWS[section];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[248px_minmax(0,1fr)] xl:items-start">
        <nav
          className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-surface p-2 shadow-1 xl:flex-col xl:overflow-visible"
          aria-label={t('sectionsLabel')}
        >
          {ADMIN_SECTIONS.map((item) => {
            const SectionIcon = SECTION_ICONS[item];
            return (
              <NavLink
                key={item}
                to={`/admin/${item}`}
                className={({ isActive }) =>
                  cn(
                    'group inline-flex min-h-11 flex-none items-center gap-3 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-text-2 outline-none transition-colors duration-(--dur) hover:bg-hover hover:text-text focus-visible:ring-1 focus-visible:ring-focus xl:flex-1',
                    isActive && 'bg-accent/10 text-accent-text hover:bg-accent/10 hover:text-accent-text',
                  )
                }
                children={({ isActive }) => (
                  <>
                    <SectionIcon className="size-[18px] flex-none" aria-hidden />
                    <span className="flex-1 text-left">{t(`sections.${item}`)}</span>
                    {isActive && <IconChevronRight className="hidden size-4 text-text-3 xl:block" aria-hidden />}
                  </>
                )}
              />
            );
          })}
        </nav>
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-1 dark:shadow-none sm:p-5" aria-label={t(`sections.${section}`)}>
          <SectionView />
        </section>
      </div>
    </>
  );
}
