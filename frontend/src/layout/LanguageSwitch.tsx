import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setLanguage } from '@/i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'kk' ? 'kk' : 'ru';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('header.language')}
          title={t('header.language')}
          data-testid="header-language-trigger"
          className="h-11 min-w-12 rounded-full border border-border bg-surface-raised px-2 font-heading text-xs font-semibold tracking-wide text-text-2 hover:bg-hover hover:text-text"
        >
          {language === 'kk' ? 'ҚАЗ' : 'RU'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-2xl p-1">
        <DropdownMenuLabel>{t('header.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => {
            if (value === 'ru' || value === 'kk') setLanguage(value);
          }}
        >
          <DropdownMenuRadioItem data-testid="header-language-option-ru" value="ru" className="min-h-11 rounded-xl">
            Русский
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem data-testid="header-language-option-kk" value="kk" className="min-h-11 rounded-xl">
            Қазақша
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
