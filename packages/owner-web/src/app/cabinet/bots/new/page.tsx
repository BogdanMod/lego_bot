'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerGetTemplates, ownerCreateBot, type TemplateMetadata, type ApiError } from '@/lib/api';

export default function CreateBotWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const templateId = searchParams.get('templateId');
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    timezone: 'Europe/Moscow',
    language: 'ru',
    inputs: {} as Record<string, string>,
  });

  const { data: templateData } = useQuery({
    queryKey: ['owner-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const templates = await ownerGetTemplates();
      return templates.items.find((t) => t.id === templateId) || null;
    },
    enabled: !!templateId,
  });

  const template = templateData || null;

  // Pre-fill form from template
  useEffect(() => {
    if (template && step === 1) {
      setFormData((prev) => ({
        ...prev,
        name: template.title,
      }));
    }
  }, [template, step]);

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

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        toast.error('Введите название бота');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (template && template.requiredInputs.length > 0) {
        const missing = template.requiredInputs
          .filter((input) => input.required && !formData.inputs[input.key])
          .map((input) => input.label);
        if (missing.length > 0) {
          toast.error(`Заполните обязательные поля: ${missing.join(', ')}`);
          return;
        }
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        templateId: templateId || undefined,
        name: formData.name,
        timezone: formData.timezone,
        language: formData.language,
        inputs: Object.keys(formData.inputs).length > 0 ? formData.inputs : undefined,
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
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                s <= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Step1BasicInfo
          formData={formData}
          onChange={(data) => setFormData((prev) => ({ ...prev, ...data }))}
        />
      )}

      {step === 2 && template && (
        <Step2TemplateInputs
          template={template}
          inputs={formData.inputs}
          onChange={(inputs) => setFormData((prev) => ({ ...prev, inputs }))}
        />
      )}

      {step === 2 && !template && (
        <div className="text-center py-8 text-muted-foreground">
          Создание бота с нуля. Нажмите "Далее" для продолжения.
        </div>
      )}

      {step === 3 && (
        <Step3Preview
          formData={formData}
          template={template}
        />
      )}

      {step === 4 && (
        <Step4Create
          formData={formData}
          template={template}
          onCreate={handleCreate}
          isLoading={createMutation.isPending}
        />
      )}

      <div className="mt-6 flex gap-3 justify-end">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Назад
          </button>
        )}
        {step < 4 && (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Далее
          </button>
        )}
      </div>
    </div>
  );
}

function Step1BasicInfo({
  formData,
  onChange,
}: {
  formData: { name: string; timezone: string; language: string };
  onChange: (data: Partial<typeof formData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Название бота</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Например: Мой бот"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Часовой пояс</label>
        <select
          value={formData.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="Europe/Moscow">Москва (Europe/Moscow)</option>
          <option value="Europe/Kiev">Киев (Europe/Kiev)</option>
          <option value="Asia/Almaty">Алматы (Asia/Almaty)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Язык</label>
        <select
          value={formData.language}
          onChange={(e) => onChange({ language: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );
}

function Step2TemplateInputs({
  template,
  inputs,
  onChange,
}: {
  template: TemplateMetadata;
  inputs: Record<string, string>;
  onChange: (inputs: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Заполните необходимые поля для настройки шаблона
      </div>
      {template.requiredInputs.map((input) => (
        <div key={input.key}>
          <label className="block text-sm font-medium mb-2">
            {input.label}
            {input.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type={input.type === 'phone' ? 'tel' : input.type === 'email' ? 'email' : 'text'}
            value={inputs[input.key] || ''}
            onChange={(e) => onChange({ ...inputs, [input.key]: e.target.value })}
            placeholder={input.description}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
          {input.description && (
            <div className="text-xs text-muted-foreground mt-1">{input.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Step3Preview({
  formData,
  template,
}: {
  formData: { name: string; inputs: Record<string, string> };
  template: TemplateMetadata | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-2">Информация о боте</h3>
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Название:</span>{' '}
            <span className="font-medium">{formData.name}</span>
          </div>
          {template && (
            <div>
              <span className="text-sm text-muted-foreground">Шаблон:</span>{' '}
              <span className="font-medium">{template.title}</span>
            </div>
          )}
        </div>
      </div>

      {template && template.defaultFlows.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Сценарии (flows)</h3>
          <div className="space-y-2">
            {template.defaultFlows.slice(0, 10).map((flow) => (
              <div
                key={flow.id}
                className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-sm">{flow.name}</div>
                  {flow.description && (
                    <div className="text-xs text-muted-foreground mt-1">{flow.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step4Create({
  formData,
  template,
  onCreate,
  isLoading,
}: {
  formData: { name: string };
  template: TemplateMetadata | null;
  onCreate: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="text-center py-8">
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Готово к созданию</h3>
        <div className="text-sm text-muted-foreground">
          Бот "{formData.name}" будет создан{template ? ` на основе шаблона "${template.title}"` : ' с нуля'}.
        </div>
      </div>
      <button
        onClick={onCreate}
        disabled={isLoading}
        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Создание...' : 'Создать бота'}
      </button>
    </div>
  );
}

