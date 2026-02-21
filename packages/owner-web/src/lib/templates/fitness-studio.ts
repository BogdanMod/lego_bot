/**
 * Fitness Studio Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'fitness_studio',
  name: 'Фитнес-студия',
  description: 'Продажа абонементов',
  icon: '💪',
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
          label: 'Название студии',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Фитнес-студия "Сила"',
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
          label: 'Краткое описание',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Тренажерный зал, групповые занятия, персональные тренировки',
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
        message: `Добро пожаловать в {{businessName}}! 💪\n\nВыберите действие:`,
        buttons: [
          { text: '📅 Записаться', nextState: 'lead_contact' },
          { text: '📅 Записаться на тренировку', nextState: 'booking' },
          { text: '💳 Купить абонемент', nextState: 'membership' },
          { text: '👨‍🏫 Тренеры', nextState: 'trainers' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      booking: {
        message: '📅 Для записи на тренировку выберите удобное время. Мы подтвердим запись!',
        buttons: [
          { text: '📅 Поделиться номером', nextState: 'lead_contact' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      membership: {
        message: '💳 Выберите тип абонемента:\n• Разовый (500₽)\n• Месячный (3000₽)\n• Годовой (25000₽)',
        buttons: [
          { text: '💳 Оплатить', nextState: 'payments' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      trainers: {
        message: '👨‍🏫 Наши тренеры. При записи вы можете указать предпочтительного тренера!',
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
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с администратором.',
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

export const fitnessStudioTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

