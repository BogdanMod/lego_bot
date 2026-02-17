/**
 * Product Support Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'product_support',
  name: 'Поддержка продукта',
  description: 'Автоматизация поддержки',
  icon: '🛟',
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
          label: 'Название продукта',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: МойСервис',
        },
        {
          id: 'contactPhone',
          label: 'Контактный телефон',
          type: 'phone' as const,
          required: false,
        },
        {
          id: 'supportEmail',
          label: 'Email поддержки',
          type: 'email' as const,
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
          label: 'Список FAQ',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Как установить, как настроить, как оплатить',
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
        message: `Добро пожаловать в поддержку {{businessName}}! 🛟\n\nЧем можем помочь?`,
        buttons: [
          { text: '❓ FAQ', nextState: 'faq' },
          { text: '🎫 Создать тикет', nextState: 'ticket' },
          { text: '💬 Связаться', nextState: 'contacts' },
        ],
      },
      faq: {
        message: '❓ Часто задаваемые вопросы:\n\n{{offerDescription}}\n\nЕсли не нашли ответ, создайте тикет!',
        buttons: [
          { text: '🎫 Создать тикет', nextState: 'ticket' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      ticket: {
        message: '🎫 Для создания тикета опишите проблему. Мы ответим в ближайшее время!',
        buttons: [
          { text: '📝 Отправить тикет', nextState: 'leads' },
          { text: '💬 Связаться с оператором', nextState: 'handoff' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      contacts: {
        message: '💬 Контакты поддержки:\n\n📞 {{contactPhone}}\n📧 {{supportEmail}}',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      help: {
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или создайте тикет.',
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

export const productSupportTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

