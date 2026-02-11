import { OwnerSection } from '@/components/owner-section';

export default function OwnerSectionPage({
  params,
}: {
  params: { botId: string; section: string };
}) {
  return <OwnerSection botId={params.botId} section={params.section} />;
}

