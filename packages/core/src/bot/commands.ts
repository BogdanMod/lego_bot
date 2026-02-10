import { Context } from 'telegraf';
import { Scenes } from 'telegraf';
import { getBotsByUserId } from '../db/bots';
import { setBotMenuButton } from '../services/telegram-webhook';
import { getMainMenuWithMiniAppKeyboard, getBackButtonKeyboard, getBotsListKeyboard } from './keyboards';

function resolveMiniAppUrl(): { url: string; source: 'MINI_APP_URL' | 'DEFAULT_MINI_APP_URL' | 'FALLBACK' } {
  const explicitUrl = process.env.MINI_APP_URL;
  if (explicitUrl) {
    return { url: explicitUrl, source: 'MINI_APP_URL' };
  }

  const defaultUrl = process.env.DEFAULT_MINI_APP_URL;
  if (defaultUrl) {
    console.warn('⚠️ MINI_APP_URL is not set, using DEFAULT_MINI_APP_URL:', defaultUrl);
    return { url: defaultUrl, source: 'DEFAULT_MINI_APP_URL' };
  }

  const fallbackUrl = 'https://lego-bot-miniapp.vercel.app';
  console.warn('⚠️ MINI_APP_URL and DEFAULT_MINI_APP_URL are not set, using default:', fallbackUrl);
  return { url: fallbackUrl, source: 'FALLBACK' };
}

/**
 * Обработчик команды /start
 */
export async function handleStart(ctx: Context) {
  const userName = ctx.from?.first_name || 'пользователь';
  const { url: miniAppUrl } = resolveMiniAppUrl();
  
  const welcomeMessage = `
👋 Привет, <b>${userName}</b>!

Я бот-конструктор диалогов для Telegram.

С моей помощью вы можете:
🤖 Создавать и управлять ботами
💬 Конструировать диалоговые сценарии
📱 Разрабатывать Mini App

<b>Доступные команды:</b>
/create_bot - Создать нового бота
/my_bots - Посмотреть моих ботов
/help - Помощь

Вы можете открыть Mini App через:
• Кнопку меню рядом с полем ввода (после настройки через /setup_miniapp)
• Кнопку "🚀 Open Mini App" ниже

Начните с команды /create_bot для создания вашего первого бота!
`;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuWithMiniAppKeyboard(miniAppUrl),
  });
}

/**
 * Обработчик команды /create_bot
 */
export async function handleCreateBot(ctx: Scenes.SceneContext) {
  await ctx.scene.enter('create_bot');
}

/**
 * Обработчик команды /my_bots
 */
export async function handleMyBots(ctx: Context) {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply('❌ Не удалось определить ваш ID пользователя.');
    return;
  }

  try {
    const bots = await getBotsByUserId(userId);

    if (bots.length === 0) {
      await ctx.reply(
        '📭 У вас пока нет созданных ботов.\n\n' +
        'Используйте команду /create_bot для создания нового бота.',
        {
          reply_markup: getBotsListKeyboard(),
        }
      );
      return;
    }

    let message = `🤖 <b>Ваши боты (${bots.length}):</b>\n\n`;

    bots.forEach((bot, index) => {
      message += `${index + 1}. <b>${bot.name}</b>\n`;
      message += `   🆔 ID: <code>${bot.id}</code>\n`;
      message += `   📅 Создан: ${new Date(bot.created_at).toLocaleString('ru-RU')}\n`;
      message += `   ${bot.webhook_set ? '🔗 Webhook: ✅ Настроен' : '🔗 Webhook: ❌ Не настроен'}\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getBotsListKeyboard(),
    });
  } catch (error) {
    console.error('Error getting bots:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка ботов.');
  }
}

/**
 * Обработчик команды /help
 */
export async function handleHelp(ctx: Context) {
  const helpMessage = `
📚 <b>Помощь</b>

<b>Основные команды:</b>
/start - Начать работу с ботом
/create_bot - Создать нового бота
/my_bots - Показать список ваших ботов
/help - Показать это сообщение
/setup_miniapp - Настроить Menu Button для Mini App

<b>Команды администратора:</b>
/setup_webhook - Настроить webhook для основного бота
/check_webhook - Проверить статус webhook

<b>Как создать бота:</b>
1. Используйте команду /create_bot
2. Следуйте инструкциям и создайте бота через @BotFather
3. Пришлите полученный токен
4. Укажите название для вашего бота

<b>Вопросы и поддержка:</b>
Если возникли проблемы, обратитесь к администратору.

<b>Безопасность:</b>
⚠️ Никогда не делитесь токенами ваших ботов с посторонними!
`;

  await ctx.reply(helpMessage, {
    parse_mode: 'HTML',
    reply_markup: getBackButtonKeyboard(),
  });
}

/**
 * Обработчик команды /setup_miniapp
 */
export async function handleSetupMiniApp(ctx: Context) {
  const { url: miniAppUrl, source: miniAppUrlSource } = resolveMiniAppUrl();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    await ctx.reply('❌ TELEGRAM_BOT_TOKEN не установлен в переменных окружения.', {
      parse_mode: 'HTML',
      reply_markup: getBackButtonKeyboard(),
    });
    return;
  }

  const adminUserIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  const userId = ctx.from?.id;

  const isAllowlistConfigured = adminUserIds.length > 0;

  if (isAllowlistConfigured) {
    if (!userId || !adminUserIds.includes(userId)) {
      await ctx.reply('⛔ Недостаточно прав', {
        parse_mode: 'HTML',
        reply_markup: getBackButtonKeyboard(),
      });
      return;
    }
  }

  let chatId: number | undefined;
  if (!isAllowlistConfigured) {
    const currentChatId = ctx.chat?.id;
    if (!currentChatId) {
      await ctx.reply('❌ Не удалось определить chat_id', {
        parse_mode: 'HTML',
        reply_markup: getBackButtonKeyboard(),
      });
      return;
    }
    chatId = currentChatId;
  } else {
    const message = ctx.message;
    if (message && 'text' in message) {
      const parts = message.text.trim().split(/\s+/);
      if (parts.length > 1) {
        const parsedChatId = Number(parts[1]);
        if (!Number.isFinite(parsedChatId)) {
          await ctx.reply('❌ Некорректный chat_id', {
            parse_mode: 'HTML',
            reply_markup: getBackButtonKeyboard(),
          });
          return;
        }
        chatId = parsedChatId;
      }
    }
  }

  try {
    const result = await setBotMenuButton(
      botToken,
      'Open Mini App',
      miniAppUrl,
      chatId
    );

    if (!result.ok) {
      throw new Error(result.description || 'Unknown error');
    }

    await ctx.reply(
      `✅ Menu Button настроен!\n\n` +
      `🔗 URL: ${miniAppUrl}\n\n` +
      `Теперь пользователи могут открыть Mini App через кнопку меню рядом с полем ввода.` +
      (isAllowlistConfigured
        ? ''
        : `\n\n⚠️ Global menu button setup requires ADMIN_USER_IDS; per-chat setup applied for this chat only.`) +
      (miniAppUrlSource === 'MINI_APP_URL'
        ? ''
        : `\n\n⚠️ MINI_APP_URL не установлен, используется ${miniAppUrlSource === 'DEFAULT_MINI_APP_URL' ? 'DEFAULT_MINI_APP_URL' : 'URL по умолчанию'}.` +
          `\nРекомендуется установить MINI_APP_URL в переменных окружения.`),
      {
        parse_mode: 'HTML',
        reply_markup: getBackButtonKeyboard(),
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(
      `❌ Ошибка настройки Menu Button: ${errorMessage}`,
      {
        parse_mode: 'HTML',
        reply_markup: getBackButtonKeyboard(),
      }
    );
  }
}

/**
 * Обработчик команды /check_webhook
 */
export async function handleCheckWebhook(ctx: Context) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    await ctx.reply('❌ TELEGRAM_BOT_TOKEN не установлен в переменных окружения.', {
      parse_mode: 'HTML',
      reply_markup: getBackButtonKeyboard(),
    });
    return;
  }

  const adminUserIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  const userId = ctx.from?.id;

  const isAllowlistConfigured = adminUserIds.length > 0;

  if (isAllowlistConfigured && (!userId || !adminUserIds.includes(userId))) {
    await ctx.reply('⛔ Недостаточно прав', {
      parse_mode: 'HTML',
      reply_markup: getBackButtonKeyboard(),
    });
    return;
  }

  try {
    const { getWebhookInfoFormatted } = await import('../services/telegram-webhook');
    const result = await getWebhookInfoFormatted(botToken);

    if (!result.ok || !result.info) {
      throw new Error(result.error || 'Failed to get webhook info');
    }

    const info = result.info;
    const isConfigured = Boolean(info.url);
    const hasErrors = Boolean(info.last_error_message);

    let message = `📡 <b>Статус Webhook</b>\n\n`;

    if (isConfigured) {
      message += `✅ Webhook настроен\n\n`;
      message += `🔗 <b>URL:</b> <code>${info.url}</code>\n`;
      message += `📊 <b>Ожидающих обновлений:</b> ${info.pending_update_count}\n`;
      
      if (info.ip_address) {
        message += `🌐 <b>IP адрес:</b> <code>${info.ip_address}</code>\n`;
      }
      
      if (info.max_connections) {
        message += `🔌 <b>Макс. соединений:</b> ${info.max_connections}\n`;
      }

      if (info.allowed_updates && info.allowed_updates.length > 0) {
        message += `📥 <b>Разрешенные обновления:</b> ${info.allowed_updates.join(', ')}\n`;
      }

      if (hasErrors) {
        message += `\n⚠️ <b>Последняя ошибка:</b>\n`;
        message += `📅 Дата: ${new Date((info.last_error_date || 0) * 1000).toLocaleString('ru-RU')}\n`;
        message += `💬 Сообщение: <code>${info.last_error_message}</code>\n`;
      }
    } else {
      message += `❌ Webhook не настроен\n\n`;
      message += `Используйте команду /setup_webhook для настройки.`;
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getBackButtonKeyboard(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(
      `❌ Ошибка проверки webhook: ${errorMessage}`,
      {
        parse_mode: 'HTML',
        reply_markup: getBackButtonKeyboard(),
      }
    );
  }
}
