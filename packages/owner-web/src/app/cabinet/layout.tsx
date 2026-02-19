import { Suspense } from 'react';
import { CabinetLayout } from '@/components/cabinet-layout';
import { ModeProvider } from '@/contexts/mode-context';

// Force dynamic rendering to avoid useSearchParams prerendering issues
export const dynamic = 'force-dynamic';

export default function OwnerCabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen p-8">Загрузка...</div>}>
      <ModeProvider>
        <CabinetLayout>{children}</CabinetLayout>
      </ModeProvider>
    </Suspense>
  );
}


