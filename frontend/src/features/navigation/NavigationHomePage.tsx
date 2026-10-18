import { useTranslation } from 'react-i18next';

export function NavigationHomePage() {
  const { t } = useTranslation();

  return (
    <h1 data-home-heading tabIndex={-1} className="sr-only">{t('nav.homeTitle')}</h1>
  );
}
