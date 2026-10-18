import { IconLogout, IconSparkles, IconTextSize } from '@tabler/icons-react';
import { useRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEnum } from '@/i18n/useEnum';

interface UserMenuProps {
  assistantEnabled: boolean;
  assistantOpen: boolean;
  largeFont: boolean;
  onAssistantChange: (open: boolean) => void;
  onLargeFontChange: (enabled: boolean) => void;
  triggerRef: Ref<HTMLButtonElement>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function UserMenu({ assistantEnabled, assistantOpen, largeFont, onAssistantChange, onLargeFontChange, triggerRef }: UserMenuProps) {
  const { t } = useTranslation();
  const e = useEnum();
  const { user, logout } = useAuth();
  const assistantOpening = useRef(false);
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('header.userMenu')}
          title={t('header.userMenu')}
          data-testid="header-user-trigger"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-text-2 outline-none transition-[transform,background-color,border-color,color] duration-150 hover:border-border-strong hover:bg-hover hover:text-text active:scale-[0.98] active:bg-pressed aria-expanded:border-border-strong aria-expanded:bg-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none motion-reduce:active:transform-none"
        >
          <Avatar className="size-8 rounded-full">
            <AvatarFallback className="rounded-full">{initials(user.full_name || user.username)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl p-1"
        onCloseAutoFocus={(event) => {
          if (!assistantOpening.current) return;
          event.preventDefault();
          assistantOpening.current = false;
          // Open after Radix removes the menu focus scope so it cannot reclaim focus.
          onAssistantChange(true);
        }}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2">
          <span className="break-words text-sm font-semibold tracking-normal text-text normal-case">{user.full_name || user.username}</span>
          <span className="text-xs font-normal tracking-normal text-text-3 normal-case">{e('role', user.role)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {assistantEnabled && (
          <DropdownMenuCheckboxItem
            data-testid="profile-ask-ai-item"
            checked={assistantOpen}
            onCheckedChange={(checked) => {
              const open = checked === true;
              if (open && !assistantOpen) {
                assistantOpening.current = true;
                return;
              }
              onAssistantChange(false);
            }}
            className="min-h-11 gap-3 rounded-xl"
          >
            <IconSparkles aria-hidden />
            {t('header.askAi')}
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuCheckboxItem
          data-testid="profile-large-font-item"
          checked={largeFont}
          onCheckedChange={(checked) => onLargeFontChange(checked === true)}
          className="min-h-11 gap-3 rounded-xl"
        >
          <IconTextSize aria-hidden />
          {t('header.largeFont')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="profile-logout-item" onSelect={logout} className="min-h-11 gap-3 rounded-xl">
          <IconLogout aria-hidden />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
