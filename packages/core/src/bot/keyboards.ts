import { InlineKeyboardMarkup } from 'telegraf/types';

/**
 * Главное меню с кнопками
 */
export function getMainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🤖 Создать бота', callback_data: 'create_bot' },
        { text: '📋 Мои боты', callback_data: 'my_bots' },
      ],
      [
        { text: 'ℹ️ Помощь', callback_data: 'help' },
      ],
    ],
  };
}

/**
 * Кнопка "Назад" для возврата в главное меню
 */
export function getBackButtonKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '⬅️ Назад', callback_data: 'back_to_menu' },
      ],
    ],
  };
}

/**
 * Кнопка "Отмена" для выхода из сцены
 */
export function getCancelButtonKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '❌ Отмена', callback_data: 'cancel_action' },
      ],
    ],
  };
}

/**
 * Кнопки для списка ботов
 */
export function getBotsListKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '➕ Создать бота', callback_data: 'create_bot' },
        { text: '⬅️ Назад', callback_data: 'back_to_menu' },
      ],
    ],
  };
}

/**
 * Кнопка для открытия Mini App
 */
export function getMiniAppKeyboard(webAppUrl: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '🚀 Open Mini App',
          web_app: { url: webAppUrl },
        },
      ],
    ],
  };
}

/**
 * Главное меню с кнопкой Mini App
 */
export function getMainMenuWithMiniAppKeyboard(webAppUrl: string): InlineKeyboardMarkup {
  const mainMenu = getMainMenuKeyboard();
  const miniAppRow = [
    {
      text: '🚀 Open Mini App',
      web_app: { url: webAppUrl },
    },
  ];

  const updatedRows = [...mainMenu.inline_keyboard];

  if (updatedRows.length > 1) {
    updatedRows.splice(1, 0, miniAppRow);
  } else {
    updatedRows.push(miniAppRow);
  }

  return {
    inline_keyboard: updatedRows,
  };
}

