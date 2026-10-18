import { useRef, type CSSProperties } from 'react';
import { useAssistantEnabled } from '@/api/hooks/assistant';
import { AssistantPanel } from '@/features/assistant/AssistantPanel';
import { usePanelState } from '@/features/assistant/usePanelState';
import { useLargeFont } from '@/lib/preferences';
import { BentoNavigation } from '@/features/navigation/BentoNavigation';
import { LanguageSwitch } from './LanguageSwitch';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';

export function AppLayout() {
  const assistantEnabled = useAssistantEnabled();
  const assistant = usePanelState();
  const userMenuRef = useRef<HTMLButtonElement>(null);
  const [largeFont, setLargeFont] = useLargeFont();
  const assistantOpen = assistantEnabled && assistant.open;

  const closeAssistant = () => {
    assistant.setOpen(false);
    userMenuRef.current?.focus();
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
            <NotificationsBell />
            <LanguageSwitch />
            <UserMenu
              triggerRef={userMenuRef}
              largeFont={largeFont}
              onLargeFontChange={setLargeFont}
              assistantEnabled={assistantEnabled}
              assistantOpen={assistantOpen}
              onAssistantChange={(open) => (open ? assistant.setOpen(true) : closeAssistant())}
            />
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
