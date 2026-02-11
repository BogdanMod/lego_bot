import React from 'react';
import { Layers, Plus, Search, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { PROJECT_THEMES } from '../../constants/brick-config';
import type { BotProject } from '../../types';
import { useProjects } from '../../contexts/ProjectsContext';
import { useLanguage } from '../../hooks/useLanguage';

export interface HomeTabProps {
  onProjectClick: (project: BotProject) => void;
  onTemplatesClick: () => void;
  onLimitReached: () => void;
}

type BotGoal = 'sales' | 'booking' | 'support' | 'leadgen';

type NewBotForm = {
  botName: string;
  businessName: string;
  contactHint: string;
  notes: string;
  goal: BotGoal;
};

type GoalPreset = {
  offers: [string, string, string];
  faq: [string, string, string];
  askText: string;
};

function getGoalPreset(goal: BotGoal): GoalPreset {
  switch (goal) {
    case 'booking':
      return {
        offers: ['Записаться на ближайшее время', 'Выбрать мастера/специалиста', 'Уточнить стоимость'],
        faq: ['Как быстро подтвердят запись?', 'Можно перенести время?', 'Как подготовиться к визиту?'],
        askText: 'Опишите, на какую услугу и когда хотите записаться.',
      };
    case 'support':
      return {
        offers: ['Проблема с заказом', 'Проблема с оплатой', 'Нужна консультация специалиста'],
        faq: ['Как быстро отвечает поддержка?', 'Где смотреть статус обращения?', 'Как связаться срочно?'],
        askText: 'Опишите вашу проблему или вопрос как можно подробнее.',
      };
    case 'leadgen':
      return {
        offers: ['Получить расчет', 'Получить консультацию', 'Заказать звонок'],
        faq: ['Что нужно для расчета?', 'Сколько времени занимает обработка?', 'Есть ли пробный период?'],
        askText: 'Опишите задачу, чтобы мы могли сделать точный расчет.',
      };
    case 'sales':
    default:
      return {
        offers: ['Подобрать товар/услугу', 'Оформить заказ', 'Узнать условия и цену'],
        faq: ['Какие сроки выполнения?', 'Какие способы оплаты?', 'Есть ли доставка?'],
        askText: 'Напишите, что именно вас интересует.',
      };
  }
}

function pickThemeColor() {
  const idx = Math.floor(Math.random() * PROJECT_THEMES.length);
  return PROJECT_THEMES[idx];
}

function buildStarterBricks(form: NewBotForm) {
  const preset = getGoalPreset(form.goal);
  const business = form.businessName.trim() || 'нашего бизнеса';
  const contactHint = form.contactHint.trim() || 'Телефон или @username';
  const ownerNote = form.notes.trim();

  return [
    {
      id: 'start',
      type: 'start' as const,
      content: `Здравствуйте! Это бот ${business}. Помогу выбрать, ответить на вопросы и принять заявку.`,
      nextId: 'main_menu',
    },
    {
      id: 'main_menu',
      type: 'menu' as const,
      content: `Выберите, что вам нужно:\n- ${preset.offers[0]}\n- ${preset.offers[1]}\n- ${preset.offers[2]}`,
      options: [
        { text: 'Услуги и предложения', targetId: 'offers_menu' },
        { text: 'Частые вопросы', targetId: 'faq_menu' },
        { text: 'Оставить заявку', targetId: 'request_input' },
        { text: 'Контакты', targetId: 'contacts_info' },
      ],
    },
    {
      id: 'offers_menu',
      type: 'menu' as const,
      content: `Основные сценарии:\n1) ${preset.offers[0]}\n2) ${preset.offers[1]}\n3) ${preset.offers[2]}`,
      options: [
        { text: preset.offers[0], targetId: 'offer_1' },
        { text: preset.offers[1], targetId: 'offer_2' },
        { text: preset.offers[2], targetId: 'offer_3' },
        { text: 'Назад в меню', targetId: 'main_menu' },
      ],
    },
    {
      id: 'offer_1',
      type: 'message' as const,
      content: `${preset.offers[0]}: расскажите подробнее в заявке, и мы подберем лучшее решение.`,
      nextId: 'request_input',
    },
    {
      id: 'offer_2',
      type: 'message' as const,
      content: `${preset.offers[1]}: оставьте заявку, и менеджер уточнит детали.`,
      nextId: 'request_input',
    },
    {
      id: 'offer_3',
      type: 'message' as const,
      content: `${preset.offers[2]}: можно быстро оформить через форму заявки.`,
      nextId: 'request_input',
    },
    {
      id: 'faq_menu',
      type: 'menu' as const,
      content: 'Частые вопросы — выберите пункт:',
      options: [
        { text: preset.faq[0], targetId: 'faq_1' },
        { text: preset.faq[1], targetId: 'faq_2' },
        { text: preset.faq[2], targetId: 'faq_3' },
        { text: 'Назад в меню', targetId: 'main_menu' },
      ],
    },
    {
      id: 'faq_1',
      type: 'message' as const,
      content: `${preset.faq[0]}\n\nОтвет: обычно в течение рабочего времени. Приоритетные обращения обрабатываются быстрее.`,
      nextId: 'main_menu',
    },
    {
      id: 'faq_2',
      type: 'message' as const,
      content: `${preset.faq[1]}\n\nОтвет: да, перенос/изменение возможно по согласованию.`,
      nextId: 'main_menu',
    },
    {
      id: 'faq_3',
      type: 'message' as const,
      content: `${preset.faq[2]}\n\nОтвет: менеджер уточнит детали после вашей заявки.`,
      nextId: 'main_menu',
    },
    {
      id: 'request_input',
      type: 'input' as const,
      content: `${preset.askText}\nДля связи укажите: ${contactHint}`,
      nextId: 'request_done',
    },
    {
      id: 'request_done',
      type: 'message' as const,
      content:
        `Спасибо! Заявка отправлена.\n` +
        `Мы свяжемся с вами по указанному контакту.\n` +
        (ownerNote ? `\nПримечание владельца: ${ownerNote}` : ''),
      nextId: 'main_menu',
    },
    {
      id: 'contacts_info',
      type: 'message' as const,
      content:
        `Контакты ${business}:\n` +
        `- Телефон: +7 (___) ___-__-__\n` +
        `- Адрес: укажите ваш адрес\n` +
        `- График: укажите часы работы`,
      nextId: 'main_menu',
    },
  ];
}

export function HomeTab({ onProjectClick, onTemplatesClick, onLimitReached }: HomeTabProps) {
  const { projects, createProjectFromTemplate, deleteProject } = useProjects();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreateWizardOpen, setIsCreateWizardOpen] = React.useState(false);
  const [newBotForm, setNewBotForm] = React.useState<NewBotForm>({
    botName: '',
    businessName: '',
    contactHint: '',
    notes: '',
    goal: 'sales',
  });

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const handleCreate = () => {
    setIsCreateWizardOpen(true);
  };

  const handleCreateFromWizard = () => {
    const safeName = newBotForm.botName.trim() || t.home.projectNameDefault;
    const starterBricks = buildStarterBricks(newBotForm);
    const created = createProjectFromTemplate(safeName, starterBricks, pickThemeColor());
    if (!created) {
      onLimitReached();
      setIsCreateWizardOpen(false);
      return;
    }
    setIsCreateWizardOpen(false);
    setNewBotForm({
      botName: '',
      businessName: '',
      contactHint: '',
      notes: '',
      goal: 'sales',
    });
    onProjectClick(created);
  };

  return (
    <div className="px-4 pt-6">
      <Modal isOpen={isCreateWizardOpen} onClose={() => setIsCreateWizardOpen(false)}>
        <Card className="rounded-3xl p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">Создать нового бота</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Пошагово настроим основу. Никаких знаний программирования не нужно.
            </div>
          </div>

          <div
            className="p-4 space-y-3 overflow-y-auto overscroll-contain"
            style={{ maxHeight: '55dvh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <Input
              label="Название бота"
              placeholder="Например: Бот студии Smile"
              value={newBotForm.botName}
              onChange={(e) => setNewBotForm((prev) => ({ ...prev, botName: e.target.value }))}
            />
            <Input
              label="Название бизнеса (для текста бота)"
              placeholder="Например: студия Smile"
              value={newBotForm.businessName}
              onChange={(e) => setNewBotForm((prev) => ({ ...prev, businessName: e.target.value }))}
            />
            <Input
              label="Какой контакт просить у клиента"
              placeholder="Например: телефон, WhatsApp, @username"
              value={newBotForm.contactHint}
              onChange={(e) => setNewBotForm((prev) => ({ ...prev, contactHint: e.target.value }))}
            />
            <Textarea
              label="Доп. пожелания к боту (необязательно)"
              rows={3}
              placeholder="Например: отвечать с 10:00 до 19:00, сделать акцент на записи в тот же день"
              value={newBotForm.notes}
              onChange={(e) => setNewBotForm((prev) => ({ ...prev, notes: e.target.value }))}
            />

            <div>
              <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">Цель бота</div>
              <div className="grid grid-cols-1 gap-2">
                {([
                  ['sales', 'Продажи и консультации'],
                  ['booking', 'Запись на услуги'],
                  ['support', 'Поддержка клиентов'],
                  ['leadgen', 'Сбор заявок'],
                ] as Array<[BotGoal, string]>).map(([goalKey, label]) => (
                  <button
                    key={goalKey}
                    onClick={() => setNewBotForm((prev) => ({ ...prev, goal: goalKey }))}
                    className={[
                      'rounded-2xl border px-3 py-2 text-left text-sm transition-all',
                      newBotForm.goal === goalKey
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCreateWizardOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={handleCreateFromWizard}>
              Создать понятного бота
            </Button>
          </div>
        </Card>
      </Modal>

      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{t.home.title}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Layers size={16} />}
            onClick={onTemplatesClick}
          >
            {t.home.templates}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={handleCreate}
          >
            {t.home.create}
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.home.searchPlaceholder}
          icon={<Search size={18} />}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {filteredProjects.length === 0 ? (
          <Card>
            <div className="text-base font-semibold text-slate-900 dark:text-white">{t.home.emptyTitle}</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.home.emptyHint}</div>
          </Card>
        ) : (
          filteredProjects.map((project) => {
            const gradient = project.themeColor || PROJECT_THEMES[0];
            const isLive = project.status === 'live';
            return (
              <Card
                key={project.id}
                gradient={gradient}
                onClick={() => onProjectClick(project)}
                className="relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{project.name}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-white/90">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            project.status === 'live'
                              ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                              : 'bg-slate-300'
                          }`}
                        />
                        <span>{isLive ? t.home.live : t.home.draft}</span>
                        <span className="text-white/60">•</span>
                        <span>
                          {project.bricks.length} {t.home.blocks}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(project.id);
                    }}
                    className="rounded-2xl p-2 text-white/90 hover:bg-white/10 active:scale-95 transition-all"
                    aria-label={t.home.delete}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
