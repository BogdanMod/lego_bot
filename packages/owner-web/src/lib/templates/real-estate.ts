/**
 * Real Estate Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'real_estate',
  name: 'Агентство недвижимости',
  description: 'Сбор лидов',
  icon: '🏠',
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
          placeholder: 'Например: Агентство недвижимости "Дом"',
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
          id: 'region',
          label: 'Регион работы',
          type: 'text' as const,
          required: false,
          placeholder: 'Например: Москва и область',
        },
      ],
    },
    {
      id: 'offer',
      title: 'Оффер',
      fields: [
        {
          id: 'offerDescription',
          label: 'Типы объектов',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Квартиры, дома, коммерческая недвижимость',
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
        message: `Добро пожаловать в {{businessName}}! 🏠\n\nЧем можем помочь?`,
        buttons: [
          { text: '🔍 Подобрать квартиру', nextState: 'search' },
          { text: '📝 Оставить заявку', nextState: 'lead' },
          { text: '📞 Связаться', nextState: 'contacts' },
        ],
      },
      search: {
        message: '🔍 Для подбора недвижимости укажите:\n• Тип объекта (квартира/дом)\n• Бюджет\n• Район\n• Количество комнат\n\nМы подберем варианты!',
        buttons: [
          { text: '📝 Оставить заявку', nextState: 'lead' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      lead: {
        message: '📝 Оставьте заявку, и наш менеджер свяжется с вами в ближайшее время!',
        buttons: [
          { text: '📝 Отправить заявку', nextState: 'leads' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      contacts: {
        message: '📞 Контакты:\n\n📍 {{address}}\n📞 {{contactPhone}}\n🌍 {{region}}',
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

export const realEstateTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

