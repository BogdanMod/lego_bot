'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { X } from 'lucide-react';

interface LeadsTabProps {
  botId: string;
}

interface Lead {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  status?: string;
  amount?: number;
  createdAt: string;
  payload?: any;
}

export function LeadsTab({ botId }: LeadsTabProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch metrics for today
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['bot-summary', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/summary`),
  });

  // Fetch leads
  const { data: leadsData, isLoading: isLeadsLoading, error } = useQuery({
    queryKey: ['leads', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/leads?limit=100`),
  });

  // Get selected lead from the list
  const selectedLead = leads.find((lead: Lead) => lead.id === selectedLeadId);

  // Update lead status
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      return ownerFetch(`/api/owner/bots/${botId}/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', botId] });
      queryClient.invalidateQueries({ queryKey: ['bot-summary', botId] });
    },
  });

  const metrics = summary?.metrics || {
    newLeadsToday: 0,
    paidOrdersToday: 0,
    revenueToday: 0,
    conversionRate: 0,
  };

  const leads = leadsData?.items || [];

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'new':
        return 'Новая';
      case 'in_progress':
        return 'В работе';
      case 'paid':
      case 'converted':
        return 'Оплачено';
      default:
        return status || 'Новая';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'new':
        return 'text-slate-600 dark:text-slate-400';
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400';
      case 'paid':
      case 'converted':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  if (isLeadsLoading || isSummaryLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Ошибка загрузки"
        description="Не удалось загрузить заявки. Попробуйте обновить страницу."
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 ${selectedLeadId ? 'mr-96' : ''} transition-all`}>
        {/* Metrics Panel */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">Новые заявки сегодня</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {metrics.newLeadsToday}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">Оплачено сегодня</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {metrics.paidOrdersToday}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">Доход за сегодня</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {metrics.revenueToday.toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">Конверсия</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {metrics.conversionRate}%
            </div>
          </div>
        </div>

        {/* Leads List */}
        {leads.length === 0 ? (
          <EmptyState
            title="Нет заявок"
            description="Заявки от пользователей бота будут отображаться здесь."
          />
        ) : (
          <div className="space-y-2">
            {leads.map((lead: Lead) => {
              const amount = lead.amount || lead.payload?.amount || 0;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {lead.name || 'Без имени'}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
                        <span className={getStatusColor(lead.status)}>
                          {getStatusLabel(lead.status)}
                        </span>
                        {amount > 0 && (
                          <span className="font-medium">{amount.toLocaleString('ru-RU')} ₽</span>
                        )}
                        {lead.createdAt && (
                          <span>
                            {new Date(lead.createdAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Panel - Lead Details */}
      {selectedLeadId && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Детали заявки
            </h2>
            <button
              onClick={() => setSelectedLeadId(null)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {selectedLead ? (
            <div className="space-y-6">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Имя</div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {selectedLead.name || 'Без имени'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Контакты</div>
                <div className="space-y-1 text-sm text-slate-900 dark:text-slate-100">
                  {selectedLead.phone && <div>📞 {selectedLead.phone}</div>}
                  {selectedLead.email && <div>✉️ {selectedLead.email}</div>}
                  {!selectedLead.phone && !selectedLead.email && (
                    <div className="text-slate-400">Нет контактов</div>
                  )}
                </div>
              </div>

              {selectedLead.message && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Комментарий</div>
                  <div className="text-sm text-slate-900 dark:text-slate-100">
                    {selectedLead.message}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Статус</div>
                <select
                  value={selectedLead.status || 'new'}
                  onChange={(e) => {
                    updateLeadMutation.mutate({
                      leadId: selectedLeadId,
                      status: e.target.value,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="new">Новая</option>
                  <option value="in_progress">В работе</option>
                  <option value="paid">Оплачено</option>
                  <option value="converted">Конвертировано</option>
                </select>
              </div>

              {(selectedLead.amount || selectedLead.payload?.amount) && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Сумма</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {(selectedLead.amount || selectedLead.payload?.amount || 0).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              )}

              {selectedLead.status !== 'paid' && selectedLead.status !== 'converted' && (
                <button
                  onClick={() => {
                    updateLeadMutation.mutate({
                      leadId: selectedLeadId,
                      status: 'paid',
                    });
                  }}
                  disabled={updateLeadMutation.isPending}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {updateLeadMutation.isPending ? 'Сохранение...' : 'Отметить как оплачено'}
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">Загрузка...</div>
          )}
        </div>
      )}
    </div>
  );
}
