import { CreateBotWizardClient } from './wizard-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

export default function CreateBotWizardPage() {
  const wizardEnabled = isOwnerWizardEnabled();
  
  return <CreateBotWizardClient wizardEnabled={wizardEnabled} />;
}
