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

