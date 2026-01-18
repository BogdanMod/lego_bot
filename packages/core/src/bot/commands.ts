import { Context } from 'telegraf';
import { Scenes } from 'telegraf';
import { getBotsByUserId } from '../db/bots';

/**
 * Обработчик команды /start
 */
export async function handleStart(ctx: Context) {
  const userName = ctx.from?.first_name || 'пользователь';
  
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

Начните с команды /create_bot для создания вашего первого бота!
`;

  await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
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
        'Используйте команду /create_bot для создания нового бота.'
      );
      return;
    }

    let message = `🤖 <b>Ваши боты (${bots.length}):</b>\n\n`;

    bots.forEach((bot, index) => {
      message += `${index + 1}. <b>${bot.name}</b>\n`;
      message += `   🆔 ID: <code>${bot.id}</code>\n`;
      message += `   📅 Создан: ${new Date(bot.created_at).toLocaleString('ru-RU')}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'HTML' });
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

  await ctx.reply(helpMessage, { parse_mode: 'HTML' });
}

