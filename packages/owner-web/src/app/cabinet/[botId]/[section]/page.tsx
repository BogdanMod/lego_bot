import { OwnerSection } from '@/components/owner-section';

export default async function OwnerSectionPage({
  params,
}: {
  params: Promise<{ botId: string; section: string }>;
}) {
  const { botId, section } = await params;
  return <OwnerSection botId={botId} section={section} />;
}

