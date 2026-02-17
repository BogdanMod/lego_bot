/**
 * Auto Service Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'auto_service',
  name: 'Автосервис',
  description: 'Прием заявок на ремонт',
  icon: '🔧',
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
          label: 'Название сервиса',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Автосервис "Мастер"',
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
          placeholder: 'Например: Ремонт двигателя, кузовные работы, диагностика',
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
        message: `Добро пожаловать в {{businessName}}! 🔧\n\nЧем можем помочь?`,
        buttons: [
          { text: '🚗 Записаться на ремонт', nextState: 'booking' },
          { text: '💰 Рассчитать стоимость', nextState: 'estimate' },
          { text: '📋 Список услуг', nextState: 'services' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      booking: {
        message: '🚗 Для записи на ремонт укажите:\n• Марку и модель авто\n• Проблему\n• Желаемое время\n\nМы свяжемся с вами!',
        buttons: [
          { text: '📅 Выбрать время', nextState: 'schedule' },
          { text: '📝 Оставить заявку', nextState: 'leads' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      estimate: {
        message: '💰 Для расчета стоимости опишите проблему или выберите услугу из списка.',
        buttons: [
          { text: '📋 Список услуг', nextState: 'services' },
          { text: '📝 Оставить заявку', nextState: 'leads' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      services: {
        message: '📋 Наши услуги:\n• Диагностика\n• Ремонт двигателя\n• Кузовные работы\n• Замена масла и фильтров\n• Шиномонтаж\n\nДля уточнения свяжитесь с нами!',
        buttons: [
          { text: '🚗 Записаться', nextState: 'booking' },
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

export const autoServiceTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

