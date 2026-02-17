/**
 * Event Manager Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'event_manager',
  name: 'Организация мероприятий',
  description: 'Сбор брифов',
  icon: '🎉',
  version: '1.0.0',
  category: 'business' as const,
};

const wizard = {
  steps: [
    {
      id: 'basic',
      title: 'Базовая информация',
      fields: [
        {
          id: 'businessName',
          label: 'Название компании',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Event-агентство "Праздник"',
        },
        {
          id: 'address',
          label: 'Адрес офиса',
          type: 'text' as const,
          required: false,
        },
        {
          id: 'contactPhone',
          label: 'Контактный телефон',
          type: 'phone' as const,
          required: true,
        },
        {
          id: 'eventTypes',
          label: 'Типы мероприятий',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Корпоративы, свадьбы, дни рождения',
        },
      ],
    },
    {
      id: 'offer',
      title: 'Оффер',
      fields: [
        {
          id: 'offerDescription',
          label: 'Краткое описание',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Полная организация мероприятий под ключ',
        },
      ],
    },
  ],
  modules: {
    handoff: true,
    schedule: true,
    faq: true,
    payments: false,
    catalog: false,
    leads: true,
  },
};

function buildBotConfig(answers: TemplateAnswers): BotConfig {
  const schema: BotSchema = {
    version: 1,
    initialState: 'start',
    states: {
      start: {
        message: `Добро пожаловать в {{businessName}}! 🎉\n\nЧем можем помочь?`,
        buttons: [
          { text: '📝 Оставить заявку', nextState: 'lead' },
          { text: '📋 Типы мероприятий', nextState: 'events' },
          { text: '📞 Связаться', nextState: 'contacts' },
        ],
      },
      lead: {
        message: '📝 Оставьте заявку на организацию мероприятия. Укажите:\n• Тип мероприятия\n• Дату\n• Количество гостей\n• Бюджет\n\nМы свяжемся с вами!',
        buttons: [
          { text: '📝 Отправить заявку', nextState: 'leads' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      events: {
        message: '📋 Мы организуем:\n\n{{eventTypes}}\n\nДля заказа оставьте заявку!',
        buttons: [
          { text: '📝 Оставить заявку', nextState: 'lead' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      contacts: {
        message: '📞 Контакты:\n\n📍 {{address}}\n📞 {{contactPhone}}',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      help: {
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с менеджером.',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
    },
  };
  
  const enabledModules: string[] = [];
  if (answers.enableHandoff) enabledModules.push('handoff');
  if (answers.enableSchedule) enabledModules.push('schedule');
  if (answers.enableFaq) enabledModules.push('faq');
  if (answers.enableLeads) enabledModules.push('leads');
  
  return finalizeBotConfig(
    {
      schema,
      metadata: {
        template: {
          id: manifest.id,
          version: manifest.version,
        },
      },
    },
    answers,
    enabledModules
  );
}

export const eventManagerTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

