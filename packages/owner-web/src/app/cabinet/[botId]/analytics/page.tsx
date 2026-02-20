'use client';

import { AnalysisDashboard } from '@/components/live-mode/analysis-dashboard';
import { useParams } from 'next/navigation';

export default function AnalyticsPage() {
  const params = useParams();
  const botId = params.botId as string;

  return (
    <div className="h-full p-6">
      <AnalysisDashboard botId={botId} />
    </div>
  );
}
