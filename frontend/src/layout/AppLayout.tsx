import { useRef, type CSSProperties } from 'react';
import { IconSparkles, IconTextSize } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAssistantEnabled } from '@/api/hooks/assistant';
import { Button } from '@/components/ui/button';
import { AssistantPanel } from '@/features/assistant/AssistantPanel';
import { usePanelState } from '@/features/assistant/usePanelState';
import { useLargeFont } from '@/lib/preferences';
import { BentoNavigation } from '@/features/navigation/BentoNavigation';
import { AppearanceMenu } from './AppearanceMenu';
import { LanguageSwitch } from './LanguageSwitch';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';

export function AppLayout() {
  const { t } = useTranslation();
  const assistantEnabled = useAssistantEnabled();
  const assistant = usePanelState();
  const askAiRef = useRef<HTMLButtonElement>(null);
  const [largeFont, setLargeFont] = useLargeFont();
  const assistantOpen = assistantEnabled && assistant.open;

  const closeAssistant = () => {
    assistant.setOpen(false);
    askAiRef.current?.focus();
  };

  return (
    <div
      className="min-h-dvh"
      style={{ '--assistant-w': assistant.expanded ? 'min(640px, 60vw)' : 'min(400px, 40vw)' } as CSSProperties}
    >
      <BentoNavigation
        assistantOpen={assistantOpen}
        headerUtilities={
          <>
            {assistantEnabled && (
              <Button
                ref={askAiRef}
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={t('header.askAi')}
                title={t('header.askAi')}
                aria-pressed={assistantOpen}
                onClick={() => (assistantOpen ? closeAssistant() : assistant.setOpen(true))}
              >
                <IconSparkles />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={t('header.largeFont')}
              title={t('header.largeFont')}
              aria-pressed={largeFont}
              onClick={() => setLargeFont(!largeFont)}
            >
              <IconTextSize />
            </Button>
            <NotificationsBell />
            <LanguageSwitch />
            <AppearanceMenu compact />
            <UserMenu />
          </>
        }
      />
      {assistantEnabled && (
        <div data-print="hide">
          <AssistantPanel open={assistantOpen} expanded={assistant.expanded} onToggleExpanded={assistant.toggleExpanded} onClose={closeAssistant} />
        </div>
      )}
    </div>
  );
}
