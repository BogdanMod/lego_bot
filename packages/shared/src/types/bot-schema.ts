/**
 * Интерфейс схемы бота для диалогов
 */
export interface BotSchema {
  version: 1;
  states: {
    [key: string]: {
      message: string;
      buttons?: Array<{
        text: string;
        nextState: string;
      }>;
    };
  };
  initialState: string;
}

/**
 * Пример валидной схемы:
 * {
 *   "version": 1,
 *   "states": {
 *     "start": {
 *       "message": "Привет! Выберите действие:",
 *       "buttons": [
 *         { "text": "О нас", "nextState": "about" },
 *         { "text": "Контакты", "nextState": "contacts" }
 *       ]
 *     },
 *     "about": {
 *       "message": "Это бот-конструктор диалогов"
 *     },
 *     "contacts": {
 *       "message": "Контакты: @username"
 *     }
 *   },
 *   "initialState": "start"
 * }
 */

