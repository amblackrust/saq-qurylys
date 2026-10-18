import { useTranslation } from 'react-i18next';

export function NavigationHomePage() {
  const { t } = useTranslation();

  return (
    <header className="mb-5 flex max-w-3xl flex-col gap-2 sm:mb-7">
      <p className="font-mono text-xs font-medium tracking-[0.08em] text-text-3 uppercase">AYQYN</p>
      <h1 data-home-heading tabIndex={-1} className="text-3xl leading-tight font-medium tracking-[-0.035em] text-text outline-none sm:text-4xl">{t('nav.homeTitle')}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-text-2 sm:text-base">{t('nav.homeIntro')}</p>
    </header>
  );
}
