import { IconChevronDown, IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
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
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';

export function AppearanceMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const options: { value: ThemeMode; label: string; icon: typeof IconSun }[] = [
    { value: 'system', label: t('appearance.system'), icon: IconDeviceDesktop },
    { value: 'light', label: t('appearance.light'), icon: IconSun },
    { value: 'dark', label: t('appearance.dark'), icon: IconMoon },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'md'}
          aria-label={compact ? t('appearance.title') : undefined}
          title={compact ? t('appearance.title') : undefined}
          className={compact ? 'rounded-full text-text-2' : 'h-11 w-full justify-start gap-3 rounded-lg px-3 text-text-2'}
        >
          <IconSun className="size-5" aria-hidden />
          {!compact && <span className="flex-1 text-left">{t('appearance.title')}</span>}
          {!compact && <span className="text-sm text-text-3">{t(`appearance.${mode}`)}</span>}
          {!compact && <IconChevronDown className="size-4" aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? 'bottom' : 'top'} className="min-w-52">
        <DropdownMenuLabel>{t('appearance.title')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as ThemeMode)}>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-11 gap-3">
              <Icon className="size-4" aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
