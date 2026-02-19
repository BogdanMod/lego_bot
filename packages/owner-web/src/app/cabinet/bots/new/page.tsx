import { Suspense } from 'react';
import { CreateBotWizardClient } from './wizard-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

// Force dynamic rendering to avoid useSearchParams prerendering issues
export const dynamic = 'force-dynamic';

export default function CreateBotWizardPage() {
  const wizardEnabled = isOwnerWizardEnabled();
  
  return (
    <Suspense fallback={<div className="panel p-8">Загрузка...</div>}>
      <CreateBotWizardClient wizardEnabled={wizardEnabled} />
    </Suspense>
  );
}
