'use client';

import { BotConstructorClient } from '@/app/cabinet/[botId]/constructor/constructor-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

interface EditModeViewProps {
  botId: string;
}

export function EditModeView({ botId }: EditModeViewProps) {
  const wizardEnabled = isOwnerWizardEnabled();

  return (
    <div className="h-full">
      <BotConstructorClient wizardEnabled={wizardEnabled} />
    </div>
  );
}

