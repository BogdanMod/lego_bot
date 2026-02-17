'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerCreateBot, type ApiError } from '@/lib/api';
import { getAllTemplates, getTemplateById, type TemplateAnswers } from '@/lib/templates';
import { validateAnswers } from '@/lib/templates/engine';
import { createEmptyBotConfig, finalizeBotConfig } from '@/lib/templates/base';

export function CreateBotWizardClient({ wizardEnabled }: { wizardEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const useTemplate = searchParams.get('template') === 'true';
  const templateIdFromUrl = searchParams.get('templateId');
  
  // Initialize selectedTemplate from URL or default
  const [step, setStep] = useState(() => {
    // If templateId is in URL, start at step 1 (skip template selection)
    return templateIdFromUrl ? 1 : 0;
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(() => {
    if (templateIdFromUrl) {
      return templateIdFromUrl;
    }
    return useTemplate ? null : 'empty';
  });
  const [answers, setAnswers] = useState<TemplateAnswers>({});
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  
  const templates = wizardEnabled ? getAllTemplates() : [];
  
  // Validate template exists if templateId is provided
  useEffect(() => {
    if (templateIdFromUrl && wizardEnabled) {
      const template = getTemplateById(templateIdFromUrl);
      if (!template) {
        toast.error(`Template ${templateIdFromUrl} not found`);
        router.push('/cabinet/bots/new');
      }
    }
  }, [templateIdFromUrl, wizardEnabled, router]);
  
  const createMutation = useMutation({
    mutationFn: ownerCreateBot,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      toast.success('Бот успешно создан');
      router.push(`/cabinet/${data.bot.botId}/overview`);
    },
    onError: (error: ApiError) => {
      if (error?.code === 'bot_limit_reached') {
        const details = error.details as { activeBots?: number; limit?: number } | undefined;
        toast.error(`Лимит ботов достигнут: ${details?.activeBots ?? '?'}/${details?.limit ?? '?'}`);
      } else {
        toast.error(error?.message || 'Ошибка при создании бота');
      }
    },
  });
  
  // Show disabled message if wizard is not enabled
  if (!wizardEnabled) {
    return (
      <div className="panel p-8 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <div className="text-2xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold mb-2">Wizard выключен</h1>
          <p className="text-muted-foreground mb-6">
            Wizard создания ботов временно недоступен. Обратитесь к администратору.
          </p>
          <button
            onClick={() => router.push('/cabinet/bots')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Вернуться к списку ботов
          </button>
        </div>
      </div>
    );
  }
  
  // Step 0: Template selection (if wizard enabled and useTemplate=true)
  if (useTemplate && step === 0) {
    return (
      <div className="panel p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Выберите шаблон</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <button
              key={template.manifest.id}
              onClick={() => {
                setSelectedTemplate(template.manifest.id);
                setStep(1);
              }}
              className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
            >
              <div className="text-2xl mb-2">{template.manifest.icon}</div>
              <div className="font-medium mb-1">{template.manifest.name}</div>
              <div className="text-sm text-muted-foreground">{template.manifest.description}</div>
            </button>
          ))}
          <button
            onClick={() => {
              setSelectedTemplate('empty');
              setStep(1);
            }}
            className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
          >
            <div className="text-2xl mb-2">➕</div>
            <div className="font-medium mb-1">Создать с нуля</div>
            <div className="text-sm text-muted-foreground">Пустой бот</div>
          </button>
        </div>
        <button
          onClick={() => router.back()}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Назад
        </button>
      </div>
    );
  }
  
  // Get current template or empty
  const template = selectedTemplate && selectedTemplate !== 'empty' 
    ? getTemplateById(selectedTemplate) 
    : null;
  
  // Show error if template was requested but not found
  if (selectedTemplate && selectedTemplate !== 'empty' && !template) {
    return (
      <div className="panel p-8 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <div className="text-2xl mb-4 text-red-500">❌</div>
          <h1 className="text-xl font-semibold mb-2">Шаблон не найден</h1>
          <p className="text-muted-foreground mb-6">
            Шаблон "{selectedTemplate}" не найден. Возможно, он был удален или переименован.
          </p>
          <button
            onClick={() => router.push('/cabinet/bots/new')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Выбрать другой шаблон
          </button>
        </div>
      </div>
    );
  }
  
  const wizardSteps = template?.wizard.steps || [
    {
      id: 'basic',
      title: 'Базовая информация',
      fields: [
        {
          id: 'businessName',
          label: 'Название бота',
          type: 'text',
          required: true,
        },
      ],
    },
  ];
  
  const currentStep = wizardSteps[step - (useTemplate ? 1 : 0)] || wizardSteps[0];
  
  const handleNext = () => {
    // Validate current step
    const validation = validateAnswers(answers, currentStep.fields);
    if (!validation.valid) {
      toast.error(validation.errors[0]?.message || 'Заполните обязательные поля');
      return;
    }
    
    if (step < wizardSteps.length + (useTemplate ? 1 : 0)) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };
  
  const handleCreate = async () => {
    try {
      let config;
      
      if (template) {
        // Build config from template
        config = template.buildBotConfig(answers);
      } else {
        // Empty bot
        config = createEmptyBotConfig(answers.businessName as string || 'Мой бот', answers);
      }
      
      // Apply modules if enabled
      if (enabledModules.length > 0) {
        config = finalizeBotConfig(config, answers, enabledModules);
      }
      
      // Don't send templateId to backend - we already built the config on frontend
      // Backend doesn't need to know about templates, just use the config
      await createMutation.mutateAsync({
        name: (answers.businessName as string) || 'Мой бот',
        timezone: (answers.timezone as string) || 'Europe/Moscow',
        language: (answers.language as string) || 'ru',
        config: {
          schema: config.schema,
          metadata: config.metadata,
        },
        // Only include template metadata in config.metadata, not as separate fields
        // This way backend doesn't try to load template
      });
    } catch (error) {
      console.error('Failed to create bot:', error);
    }
  };
  
  return (
    <div className="panel p-8 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Назад
      </button>
      
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Создание бота</h1>
        <div className="flex gap-2">
          {wizardSteps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded ${
                i <= step - (useTemplate ? 1 : 0) ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">{currentStep.title}</h2>
        {currentStep.description && (
          <p className="text-sm text-muted-foreground mb-4">{currentStep.description}</p>
        )}
        
        <div className="space-y-4">
          {currentStep.fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={(answers[field.id] as string) || ''}
                  onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  rows={4}
                />
              ) : (
                <input
                  type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  value={(answers[field.id] as string) || ''}
                  onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              {field.help && (
                <div className="text-xs text-muted-foreground mt-1">{field.help}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Modules selection (if template supports it) */}
      {template && step === wizardSteps.length && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">Дополнительные модули</h3>
          <div className="space-y-2">
            {Object.entries(template.wizard.modules).map(([moduleId, enabled]) => {
              if (!enabled) return null;
              return (
                <label key={moduleId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enabledModules.includes(moduleId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEnabledModules([...enabledModules, moduleId]);
                      } else {
                        setEnabledModules(enabledModules.filter(m => m !== moduleId));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {moduleId === 'handoff' && '💬 Передача администратору'}
                    {moduleId === 'schedule' && '📅 Запись/расписание'}
                    {moduleId === 'faq' && '❓ FAQ'}
                    {moduleId === 'payments' && '💳 Оплата'}
                    {moduleId === 'catalog' && '📦 Каталог'}
                    {moduleId === 'leads' && '📝 Сбор лидов'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="flex gap-3 justify-end">
        {step > (useTemplate ? 1 : 0) && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Назад
          </button>
        )}
        <button
          onClick={step < wizardSteps.length + (useTemplate ? 0 : 0) ? handleNext : handleCreate}
          disabled={createMutation.isPending}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {step < wizardSteps.length + (useTemplate ? 0 : 0) ? 'Далее' : createMutation.isPending ? 'Создание...' : 'Создать'}
        </button>
      </div>
    </div>
  );
}

