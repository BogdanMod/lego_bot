/**
 * Lawyer Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'lawyer',
  name: 'Юридические услуги',
  description: 'Квалификация клиентов',
  icon: '⚖️',
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
          placeholder: 'Например: Юридическая компания "Право"',
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
      ],
    },
    {
      id: 'offer',
      title: 'Оффер',
      fields: [
        {
          id: 'offerDescription',
          label: 'Список услуг',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Консультации, составление документов, представительство в суде',
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
        message: `Добро пожаловать в {{businessName}}! ⚖️\n\nЧем можем помочь?`,
        buttons: [
          { text: '💬 Получить консультацию', nextState: 'consultation' },
          { text: '📋 Список услуг', nextState: 'services' },
          { text: '📞 Связаться', nextState: 'contacts' },
        ],
      },
      consultation: {
        message: '💬 Для получения консультации опишите вашу ситуацию. Наш юрист свяжется с вами!',
        buttons: [
          { text: '📝 Оставить заявку', nextState: 'leads' },
          { text: '📅 Поделиться номером', nextState: 'lead_contact' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      services: {
        message: '📋 Наши услуги:\n• Консультации\n• Составление документов\n• Представительство в суде\n• Регистрация бизнеса\n\nДля уточнения свяжитесь с нами!',
        buttons: [
          { text: '💬 Консультация', nextState: 'consultation' },
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
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с юристом.',
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

export const lawyerTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

