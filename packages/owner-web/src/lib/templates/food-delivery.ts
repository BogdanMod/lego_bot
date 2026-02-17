/**
 * Food Delivery Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'food_delivery',
  name: 'Доставка еды',
  description: 'Прием заказов и доставка',
  icon: '🍔',
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
          label: 'Название заведения',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Доставка "Вкусно"',
        },
        {
          id: 'address',
          label: 'Адрес кухни/офиса',
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
        {
          id: 'menuUrl',
          label: 'Ссылка на меню (опционально)',
          type: 'url' as const,
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
          placeholder: 'Например: Быстрая доставка, горячие блюда, напитки',
        },
      ],
    },
  ],
  modules: {
    handoff: true,
    schedule: false,
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
        message: `Добро пожаловать в {{businessName}}! 🍔\n\nЧто вас интересует?`,
        buttons: [
          { text: '📋 Меню', nextState: 'menu' },
          { text: '🛒 Заказать', nextState: 'order' },
          { text: '📦 Отследить заказ', nextState: 'track' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      menu: {
        message: '📋 Наше меню:\n\n{{menuUrl}}\n\nДля заказа выберите "Заказать"',
        buttons: [
          { text: '🛒 Заказать', nextState: 'order' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      order: {
        message: '🛒 Для оформления заказа укажите:\n• Блюда из меню\n• Адрес доставки\n• Время доставки\n\nМы свяжемся с вами для подтверждения!',
        buttons: [
          { text: '💳 Оплатить', nextState: 'payments' },
          { text: '📞 Связаться', nextState: 'handoff' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      track: {
        message: '📦 Для отслеживания заказа укажите номер заказа или свяжитесь с нами.',
        buttons: [
          { text: '📞 Связаться', nextState: 'handoff' },
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
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с нами.',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
    },
  };
  
  const enabledModules: string[] = [];
  if (answers.enableHandoff) enabledModules.push('handoff');
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

export const foodDeliveryTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

