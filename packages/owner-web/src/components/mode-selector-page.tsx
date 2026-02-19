'use client';

import { useRouter } from 'next/navigation';
import { useWorkMode } from '@/contexts/mode-context';
import { Bot, FileText } from 'lucide-react';

export function ModeSelectorPage() {
  const router = useRouter();
  const { setMode } = useWorkMode();

  const handleSelectEdit = () => {
    setMode('edit');
    router.push('/cabinet/bots?mode=edit');
  };

  const handleSelectManage = () => {
    setMode('manage');
    router.push('/cabinet?mode=manage');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-2xl w-full space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            ZerCon
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Zero Context Systems
          </p>
        </div>

        {/* Subtitle */}
        <div className="text-center">
          <p className="text-lg text-slate-700 dark:text-slate-300">
            Выберите, что вы хотите сделать
          </p>
        </div>

        {/* Mode Selection Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Edit Mode */}
          <button
            onClick={handleSelectEdit}
            className="group relative p-8 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-primary/50 transition-all text-left bg-white dark:bg-slate-900"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div className="text-2xl">1️⃣</div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Настроить бота
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Мастер создания и редактирования логики бота
                </p>
              </div>
            </div>
          </button>

          {/* Manage Mode */}
          <button
            onClick={handleSelectManage}
            className="group relative p-8 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-primary/50 transition-all text-left bg-white dark:bg-slate-900"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="text-2xl">2️⃣</div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Работать с заявками
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Просмотр заявок, заказов и клиентов
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

