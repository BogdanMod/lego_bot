import { BotsPageClient } from './bots-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

export default function BotsPage() {
  const wizardEnabled = isOwnerWizardEnabled();
  
  return <BotsPageClient wizardEnabled={wizardEnabled} />;
}
