/**
 * Education Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'education',
  name: 'Онлайн-школа',
  description: 'Продажа курсов',
  icon: '📚',
  version: '1.0.0',
  category: 'education' as const,
};

const wizard = {
  steps: [
    {
      id: 'basic',
      title: 'Базовая информация',
      fields: [
        {
          id: 'businessName',
          label: 'Название школы',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Онлайн-школа "Знания"',
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
          label: 'Список курсов',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Программирование, дизайн, маркетинг',
        },
      ],
    },
  ],
  modules: {
    handoff: true,
    schedule: true,
    faq: true,
    payments: true,
    catalog: true,
    leads: false,
  },
};

function buildBotConfig(answers: TemplateAnswers): BotConfig {
  const schema: BotSchema = {
    version: 1,
    initialState: 'start',
    states: {
      start: {
        message: `Добро пожаловать в {{businessName}}! 📚\n\nВыберите действие:`,
        buttons: [
          { text: '📚 Каталог курсов', nextState: 'catalog' },
          { text: '📝 Записаться', nextState: 'enroll' },
          { text: '💳 Оплатить', nextState: 'payment' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      catalog: {
        message: '📚 Наши курсы. Выберите интересующий курс для записи!',
        buttons: [
          { text: '📝 Записаться', nextState: 'enroll' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      enroll: {
        message: '📝 Для записи на курс выберите курс из каталога и укажите ваши данные. Мы свяжемся с вами!',
        buttons: [
          { text: '📚 Каталог', nextState: 'catalog' },
          { text: '📅 Поделиться номером', nextState: 'lead_contact' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      payment: {
        message: '💳 Для оплаты курса выберите курс и способ оплаты.',
        buttons: [
          { text: '💳 Оплатить', nextState: 'payments' },
          { text: '📚 Каталог', nextState: 'catalog' },
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
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с нами.',
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
  if (answers.enableCatalog) enabledModules.push('catalog');
  
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

export const educationTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

