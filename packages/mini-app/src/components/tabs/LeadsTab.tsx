import { User } from 'lucide-react';
import { Card } from '../ui/Card';
import { MOCK_LEADS } from '../../data/mock-leads';
import { useLanguage } from '../../hooks/useLanguage';

export function LeadsTab() {
  const { t } = useLanguage();

  return (
    <div className="px-4 pt-6">
      <div className="text-2xl font-semibold text-slate-900 dark:text-white">{t.leads.title}</div>

      <div className="mt-6 flex flex-col gap-4">
        {MOCK_LEADS.map((lead) => (
          <Card key={lead.id} className="rounded-[2.25rem]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <User size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{lead.userName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{lead.botName}</div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{lead.time}</div>
                </div>
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">{lead.data}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

