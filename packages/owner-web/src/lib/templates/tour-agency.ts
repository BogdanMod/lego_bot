/**
 * Tour Agency Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'tour_agency',
  name: 'Тур-агентство',
  description: 'Подбор туров',
  icon: '✈️',
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
          label: 'Название агентства',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Тур-агентство "Путешествия"',
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
          id: 'destinations',
          label: 'Направления',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Турция, Египет, ОАЭ, Таиланд',
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
          placeholder: 'Например: Пляжный отдых, экскурсионные туры, горнолыжные курорты',
        },
      ],
    },
  ],
  modules: {
    handoff: true,
    schedule: false,
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
        message: `Добро пожаловать в {{businessName}}! ✈️\n\nЧем можем помочь?`,
        buttons: [
          { text: '🔍 Подобрать тур', nextState: 'search' },
          { text: '📝 Оставить заявку', nextState: 'lead' },
          { text: '📞 Связаться', nextState: 'contacts' },
        ],
      },
      search: {
        message: '🔍 Для подбора тура укажите:\n• Направление\n• Даты поездки\n• Количество человек\n• Бюджет\n\nМы подберем варианты!',
        buttons: [
          { text: '📝 Оставить заявку', nextState: 'lead' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      lead: {
        message: '📝 Оставьте заявку на подбор тура, и наш менеджер свяжется с вами!',
        buttons: [
          { text: '📝 Отправить заявку', nextState: 'leads' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      contacts: {
        message: '📞 Контакты:\n\n📍 {{address}}\n📞 {{contactPhone}}\n🌍 Направления: {{destinations}}',
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

export const tourAgencyTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

