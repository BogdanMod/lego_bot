import { CabinetLayout } from '@/components/cabinet-layout';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function OwnerCabinetLayout({ children }: { children: React.ReactNode }) {
  return <CabinetLayout>{children}</CabinetLayout>;
}


