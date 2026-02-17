import { BotConstructorClient } from './constructor-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

export default function BotConstructorPage() {
  const wizardEnabled = isOwnerWizardEnabled();
  
  return <BotConstructorClient wizardEnabled={wizardEnabled} />;
}

