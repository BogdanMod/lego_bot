/**
 * Coffee Shop Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'coffee_shop',
  name: 'Кофейня / Кафе',
  description: 'Прием заказов и бронирование столов',
  icon: '☕',
  version: '1.0.0',
  category: 'business' as const,
};

const wizard = {
  steps: [
    {
      id: 'basic',
      title: 'Базовая информация',
      description: 'Основные данные о вашем заведении',
      fields: [
        {
          id: 'businessName',
          label: 'Название заведения',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: Кофейня на углу',
          validation: { min: 2, max: 100 },
        },
        {
          id: 'address',
          label: 'Адрес',
          type: 'text' as const,
          required: true,
          placeholder: 'Город, улица, дом',
        },
        {
          id: 'contactPhone',
          label: 'Контактный телефон',
          type: 'phone' as const,
          required: true,
          placeholder: '+7 (999) 123-45-67',
        },
        {
          id: 'workingHours',
          label: 'Часы работы',
          type: 'text' as const,
          required: false,
          placeholder: 'Пн-Вс: 9:00 - 22:00',
        },
        {
          id: 'menuUrl',
          label: 'Ссылка на меню (опционально)',
          type: 'url' as const,
          required: false,
          placeholder: 'https://...',
        },
      ],
    },
    {
      id: 'offer',
      title: 'Оффер',
      description: 'Что ваш бот делает',
      fields: [
        {
          id: 'offerDescription',
          label: 'Краткое описание',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Принимаем заказы на вынос, бронируем столики, рассказываем об акциях',
          help: 'Это описание будет использоваться в приветственном сообщении',
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
        message: `Добро пожаловать в {{businessName}}! ☕\n\nЧто вас интересует?`,
        buttons: [
          { text: '📋 Меню', nextState: 'menu' },
          { text: '🛒 Заказать', nextState: 'order' },
          { text: '🪑 Забронировать стол', nextState: 'booking' },
          { text: '🎁 Акции', nextState: 'promotions' },
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
        message: '🛒 Для оформления заказа свяжитесь с нами:\n\n📞 {{contactPhone}}\n\nИли оставьте заявку, и мы вам перезвоним!',
        buttons: [
          { text: '📞 Связаться', nextState: 'handoff' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      booking: {
        message: '🪑 Для бронирования столика укажите:\n• Дата и время\n• Количество гостей\n• Ваше имя и телефон\n\nМы свяжемся с вами для подтверждения!',
        buttons: [
          { text: '📅 Забронировать', nextState: 'schedule' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      promotions: {
        message: '🎁 Текущие акции:\n\n• Скидка 10% на завтраки до 12:00\n• Каждый 5-й кофе в подарок\n• Скидка 15% при заказе от 1000₽\n\nСледите за новыми акциями!',
        buttons: [
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

export const coffeeShopTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

