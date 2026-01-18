import { Scenes, Context } from 'telegraf';
import { createBot, botExistsByToken } from '../db/bots';

// Интерфейс для данных сессии
interface BotCreationSession {
  step: 'waiting_for_token' | 'waiting_for_name' | null;
  token?: string;
  name?: string;
}

// Расширение контекста для хранения данных сессии
interface BotWizardSession extends Scenes.WizardSession {
  botCreation: BotCreationSession;
}

export interface BotWizardContext extends Context, Scenes.WizardContext<BotWizardSession> {}

// Сцена создания бота
export const createBotScene = new Scenes.WizardScene<BotWizardContext>(
  'create_bot',
  async (ctx: BotWizardContext) => {
    // Инициализация сессии
    if (!ctx.scene.session.botCreation) {
      ctx.scene.session.botCreation = {
        step: 'waiting_for_token',
      };
    }

    // Отправляем инструкцию
    const instruction = `
🤖 <b>Создание нового бота</b>

Для создания бота выполните следующие шаги:

1️⃣ Откройте <a href="https://t.me/BotFather">@BotFather</a> в Telegram

2️⃣ Отправьте команду:
<code>/newbot</code>

3️⃣ Следуйте инструкциям BotFather:
   • Придумайте имя для вашего бота
   • Придумайте username (должен заканчиваться на "bot")

4️⃣ После создания бота BotFather пришлет вам токен

5️⃣ Скопируйте и пришлите мне токен бота

Токен выглядит примерно так:
<code>123456789:ABCdefGHIjklMNOpqrsTUVwxyz</code>

⚠️ <b>Важно:</b> Не делитесь токеном ни с кем, кроме этого бота!
`;

    await ctx.reply(instruction, { parse_mode: 'HTML' });
    ctx.scene.session.botCreation.step = 'waiting_for_token';
    return ctx.wizard.next();
  },
  
  async (ctx: BotWizardContext) => {
    // Шаг 1: Получение токена
    const message = ctx.message;
    
    if (!('text' in message)) {
      await ctx.reply('❌ Пожалуйста, отправьте текстовое сообщение с токеном бота.');
      return;
    }

    const token = message.text.trim();

    // Валидация токена
    if (!token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      await ctx.reply(
        '❌ Неверный формат токена. Токен должен выглядеть так: <code>123456789:ABCdefGHIjklMNOpqrsTUVwxyz</code>',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Проверка, не существует ли уже такой токен
    const exists = await botExistsByToken(token);
    if (exists) {
      await ctx.reply('❌ Бот с таким токеном уже зарегистрирован в системе.');
      return ctx.scene.leave();
    }

    // Сохраняем токен в сессии
    ctx.scene.session.botCreation.token = token;
    ctx.scene.session.botCreation.step = 'waiting_for_name';

    await ctx.reply(
      '✅ Токен принят!\n\n📝 Теперь придумайте название для вашего бота (до 100 символов):'
    );
    return ctx.wizard.next();
  },
  
  async (ctx: BotWizardContext) => {
    // Шаг 2: Получение названия
    const message = ctx.message;
    
    if (!('text' in message)) {
      await ctx.reply('❌ Пожалуйста, отправьте название бота текстом.');
      return;
    }

    const name = message.text.trim();

    if (name.length === 0) {
      await ctx.reply('❌ Название не может быть пустым.');
      return;
    }

    if (name.length > 100) {
      await ctx.reply('❌ Название слишком длинное (максимум 100 символов).');
      return;
    }

    // Сохраняем название
    ctx.scene.session.botCreation.name = name;

    try {
      // Создаем бота в базе данных
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply('❌ Не удалось определить ваш ID пользователя.');
        return ctx.scene.leave();
      }

      const botData = {
        user_id: userId,
        token: ctx.scene.session.botCreation.token!,
        name: ctx.scene.session.botCreation.name!,
      };

      const bot = await createBot(botData);

      await ctx.reply(
        `✅ <b>Бот успешно создан!</b>\n\n` +
        `🆔 ID: <code>${bot.id}</code>\n` +
        `📛 Название: ${bot.name}\n` +
        `📅 Создан: ${new Date(bot.created_at).toLocaleString('ru-RU')}\n\n` +
        `Теперь вы можете использовать этого бота в системе.`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error creating bot:', error);
      await ctx.reply('❌ Произошла ошибка при создании бота. Попробуйте позже.');
    }

    return ctx.scene.leave();
  }
);

// Обработчик ошибок в сцене
createBotScene.action('cancel', async (ctx: BotWizardContext) => {
  await ctx.reply('❌ Создание бота отменено.');
  return ctx.scene.leave();
});

