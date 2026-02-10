export type IntegrationTemplateDefinition = {
  id: 'google_sheets' | 'telegram_channel' | 'custom';
  name: string;
  description: string;
  icon: string;
  setupInstructions: string;
  config: Record<string, any>;
};

export const INTEGRATION_TEMPLATES: IntegrationTemplateDefinition[] = [
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Сохранять контакты в Google таблицу',
    icon: '📊',
    setupInstructions: 'Инструкция по созданию Apps Script webhook',
    config: {
      spreadsheetUrl: '',
      sheetName: 'Лист1',
      columns: ['Дата', 'ID', 'Имя', 'Телефон', 'Email'],
    },
  },
  {
    id: 'telegram_channel',
    name: 'Telegram канал',
    description: 'Отправлять уведомления в канал',
    icon: '📣',
    setupInstructions: 'Добавьте бота админом канала',
    config: {
      channelId: '@channel_name',
      messageTemplate: '📩 Новая запись\n👤 {first_name}\n📱 {phone_number}',
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Произвольный webhook endpoint',
    icon: '⚙️',
    setupInstructions: 'Настройте собственный endpoint для получения данных',
    config: {},
  },
];
