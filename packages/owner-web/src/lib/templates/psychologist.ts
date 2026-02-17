/**
 * Psychologist Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'psychologist',
  name: 'Психолог / Коуч',
  description: 'Запись на консультацию',
  icon: '🧠',
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
          label: 'Имя специалиста',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Анна Иванова',
        },
        {
          id: 'contactPhone',
          label: 'Контактный телефон',
          type: 'phone' as const,
          required: true,
        },
        {
          id: 'price',
          label: 'Стоимость консультации',
          type: 'text' as const,
          required: false,
          placeholder: 'Например: 3000₽/час',
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
          placeholder: 'Например: Индивидуальные консультации, семейная терапия, коучинг',
        },
      ],
    },
  ],
  modules: {
    handoff: true,
    schedule: true,
    faq: true,
    payments: true,
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
        message: `Добро пожаловать! Я {{businessName}} 🧠\n\nЧем могу помочь?`,
        buttons: [
          { text: '📅 Записаться на консультацию', nextState: 'booking' },
          { text: '💰 Стоимость', nextState: 'price' },
          { text: '❓ FAQ', nextState: 'faq' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      booking: {
        message: '📅 Для записи на консультацию выберите удобное время. Мы подтвердим запись!',
        buttons: [
          { text: '📅 Выбрать время', nextState: 'schedule' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      price: {
        message: '💰 Стоимость консультации:\n\n{{price}}\n\nДля записи выберите "Записаться на консультацию".',
        buttons: [
          { text: '📅 Записаться', nextState: 'booking' },
          { text: '💳 Оплатить', nextState: 'payments' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      contacts: {
        message: '📞 Контакты:\n\n📞 {{contactPhone}}',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      help: {
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь со мной.',
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
  if (answers.enablePayments) enabledModules.push('payments');
  
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

export const psychologistTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

