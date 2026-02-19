import { CabinetLayout } from '@/components/cabinet-layout';
import { ModeProvider } from '@/contexts/mode-context';

export default function OwnerCabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <CabinetLayout>{children}</CabinetLayout>
    </ModeProvider>
  );
}


