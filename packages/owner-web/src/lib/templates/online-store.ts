/**
 * Online Store Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'online_store',
  name: 'Интернет-магазин',
  description: 'Продажи через Telegram',
  icon: '🛒',
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
          label: 'Название магазина',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Магазин "Все для дома"',
        },
        {
          id: 'address',
          label: 'Адрес склада/офиса',
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
          label: 'Краткое описание товаров',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Одежда, электроника, товары для дома',
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
        message: `Добро пожаловать в {{businessName}}! 🛒\n\nЧто вас интересует?`,
        buttons: [
          { text: '📦 Каталог', nextState: 'catalog' },
          { text: '🛒 Корзина', nextState: 'cart' },
          { text: '📦 Отследить заказ', nextState: 'track' },
          { text: '💬 Поддержка', nextState: 'support' },
          { text: '📞 Контакты', nextState: 'contacts' },
        ],
      },
      catalog: {
        message: '📦 Наш каталог товаров. Выберите категорию или воспользуйтесь поиском.',
        buttons: [
          { text: '🛒 В корзину', nextState: 'cart' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      cart: {
        message: '🛒 Ваша корзина. Для оформления заказа нажмите "Оформить заказ".',
        buttons: [
          { text: '💳 Оформить заказ', nextState: 'checkout' },
          { text: '📦 Каталог', nextState: 'catalog' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      checkout: {
        message: '💳 Оформление заказа. Укажите адрес доставки и способ оплаты.',
        buttons: [
          { text: '💳 Оплатить', nextState: 'payments' },
          { text: '⬅️ Назад', nextState: 'cart' },
        ],
      },
      track: {
        message: '📦 Для отслеживания заказа укажите номер заказа или свяжитесь с нами.',
        buttons: [
          { text: '💬 Поддержка', nextState: 'support' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      support: {
        message: '💬 Служба поддержки. Мы ответим на все ваши вопросы!',
        buttons: [
          { text: '📞 Связаться', nextState: 'handoff' },
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
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с поддержкой.',
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

export const onlineStoreTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

