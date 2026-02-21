/**
 * Beauty Salon Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'beauty_salon',
  name: 'Салон красоты',
  description: 'Онлайн запись клиентов',
  icon: '💅',
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
          label: 'Название салона',
          type: 'text' as const,
          required: true,
        },
        {
          id: 'address',
          label: 'Адрес',
          type: 'text' as const,
          required: true,
        },
        {
          id: 'contactPhone',
          label: 'Контактный телефон',
          type: 'phone' as const,
          required: true,
        },
        {
          id: 'workingHours',
          label: 'Часы работы',
          type: 'text' as const,
          required: false,
        },
      ],
    },
    {
      id: 'offer',
      title: 'Оффер',
      fields: [
        {
          id: 'offerDescription',
          label: 'Краткое описание услуг',
          type: 'textarea' as const,
          required: false,
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
    leads: false,
  },
};

function buildBotConfig(answers: TemplateAnswers): BotConfig {
  const schema: BotSchema = {
    version: 1,
    initialState: 'start',
    states: {
      start: {
        message: `Добро пожаловать в {{businessName}}! 💅\n\nВыберите действие:`,
        buttons: [
          { text: '📅 Записаться', nextState: 'booking' },
          { text: '💰 Прайс-лист', nextState: 'prices' },
          { text: '👩‍💼 Мастера', nextState: 'masters' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      booking: {
        message: '📅 Для записи на услугу оставьте контакт — мы свяжемся с вами!',
        buttons: [
          { text: '📅 Поделиться номером', nextState: 'lead_contact' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      prices: {
        message: '💰 Наши услуги и цены. Для уточнения свяжитесь с нами!',
        buttons: [
          { text: '📅 Записаться', nextState: 'booking' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      masters: {
        message: '👩‍💼 Наши мастера. При записи вы можете указать предпочтительного мастера!',
        buttons: [
          { text: '📅 Записаться', nextState: 'booking' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      contacts: {
        message: '📞 Контакты:\n\n📍 {{address}}\n📞 {{contactPhone}}\n🕐 {{workingHours}}',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      help: {
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше.',
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

export const beautySalonTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

