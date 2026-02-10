export const translations = {
  RU: {
    app: {
      name: 'Lego Bot',
    },
    tabs: {
      home: 'Главная',
      leads: 'Заявки',
      store: 'Подписка',
      settings: 'Настройки',
    },
    home: {
      title: 'Проекты',
      templates: 'Галерея шаблонов',
      create: 'Создать',
      searchPlaceholder: 'Поиск проектов...',
      blocks: 'блоков',
      draft: 'Черновик',
      live: 'В эфире',
      delete: 'Удалить',
      emptyTitle: 'Нет проектов',
      emptyHint: 'Создайте свой первый проект',
      projectNameDefault: 'Новый проект',
    },
    editor: {
      title: 'Редактор',
      backToProjects: 'Назад',
      save: 'Сохранить',
      saving: 'Сохранение...',
      publish: 'Опубликовать',
      preview: 'Превью',
      hidePreview: 'Скрыть превью',
      addBlock: 'Добавить блок',
      blockTypes: {
        message: 'Сообщение',
        menu: 'Меню',
        input: 'Ввод',
        start: 'Старт',
      },
      blockLabels: {
        message: 'Текстовое сообщение',
        menu: 'Меню с кнопками',
        input: 'Запрос данных',
        start: 'Начало диалога',
      },
      placeholders: {
        message: 'Введите текст сообщения...',
        menu: 'Выберите опцию:',
        input: 'Введите ваш ответ:',
        start: 'Добро пожаловать!',
        buttonText: 'Текст кнопки',
      },
      jumpTo: 'Переход к:',
      noNext: 'Конец цепочки',
      nextBlock: 'Следующий блок',
      addButton: '+ Добавить кнопку',
      editButtons: 'Настройка кнопок',
      deleteBlock: 'Удалить блок',
      deleteConfirm: 'Удалить этот блок?',
      blockNumber: 'Блок #',
      dragHint: 'Перетащите для изменения порядка',
      connectTo: 'Связать с:',
      validation: {
        noStart: 'Добавьте блок "Старт"',
        emptyContent: 'Заполните содержимое блока',
        noButtons: 'Добавьте хотя бы одну кнопку',
        invalidTransition: 'Неверная связь между блоками',
      },
    },
    sync: {
      saving: 'Сохранение...',
      saved: 'Сохранено',
      error: 'Ошибка синхронизации',
      offline: 'Нет подключения',
      retry: 'Повторить',
      conflict: 'Конфликт версий',
      conflictMessage: 'Схема была изменена на сервере',
      loadServer: 'Загрузить с сервера',
      keepLocal: 'Сохранить мою версию',
    },
    errors: {
      network: 'Проблема с сетью. Проверьте подключение.',
      validation: 'Ошибка валидации данных',
      conflict: 'Конфликт версий. Обновите страницу.',
      unknown: 'Неизвестная ошибка',
    },
    publish: {
      title: 'Публикация', // EN: 'Publish'
      subtitle: 'Подключение к Telegram', // EN: 'Connect to Telegram'
      description: 'Введите API токен, полученный у @BotFather в Telegram.', // EN: 'Enter the API token from @BotFather in Telegram.'
      botToken: 'API Токен', // EN: 'API Token'
      tokenPlaceholder: '000000000:AAHHH...', // EN: '000000000:AAHHH...'
      deploy: 'Запустить бота', // EN: 'Deploy Bot'
      deploying: 'Запуск...', // EN: 'Deploying...'
      success: 'Готово!', // EN: 'Success!'
      successMessage: 'Бот успешно запущен!', // EN: 'Bot is live!'
      backToEditor: 'Назад к редактору', // EN: 'Back to Editor'
    },
    simulator: {
      liveMode: 'Живой режим', // EN: 'Live Mode'
      restart: 'Перезапуск', // EN: 'Restart'
      userInputPlaceholder: 'Пользователь введет текст здесь...', // EN: 'User input here...'
      send: 'Отправить', // EN: 'Send'
      typeMessage: 'Введите сообщение...', // EN: 'Type message...'
      noStartBlock: 'Добавьте блок "Старт" для начала', // EN: 'Add a "Start" block to begin'
      endOfFlow: 'Конец диалога', // EN: 'End of conversation'
    },
    templates: {
      title: 'Галерея шаблонов',
      subtitle: 'Выберите готовый шаблон',
      backToHome: 'Назад',
      useTemplate: 'Использовать',
      blankProject: 'Пустой проект',
      blankDescription: 'Начните с чистого листа',
      bricksCount: 'блоков',
    },
    leads: {
      title: 'Заявки',
    },
    store: {
      title: 'Подписка',
      freeFeatures: ['1 бот', 'Базовые блоки', 'Аналитика'],
      premiumFeatures: ['5 ботов', 'Умная логика', 'Брендинг', 'CRM'],
      free: {
        name: 'Free',
        price: 'Бесплатно',
        description: 'Базовый доступ',
      },
      premium: {
        name: 'Premium',
        price: 'Премиум',
        description: 'Расширенные лимиты',
      },
      active: 'Активен',
      choose: 'Выбрать',
      features: {
        projects: 'Проекты',
        bricks: 'Блоки на проект',
        support: 'Поддержка',
      },
      support: {
        basic: 'Базовая',
        premium: 'Премиальная',
      },
    },
    settings: {
      title: 'Настройки',
      profileName: 'Architect',
      theme: 'Тема',
      security: 'Безопасность',
      billing: 'Оплата',
      notifications: 'Уведомления',
      logout: 'Выйти',
    },
    limit: {
      title: 'Лимит достигнут',
      description: 'Вы достигли лимита проектов. Оформите подписку, чтобы увеличить лимиты.',
      subscription: 'Подписка',
      later: 'Позже',
    },
  },
  EN: {
    app: {
      name: 'Lego Bot',
    },
    tabs: {
      home: 'Home',
      leads: 'Leads',
      store: 'Subscription',
      settings: 'Settings',
    },
    home: {
      title: 'Projects',
      templates: 'Templates gallery',
      create: 'Create',
      searchPlaceholder: 'Search projects...',
      blocks: 'blocks',
      draft: 'Draft',
      live: 'Live',
      delete: 'Delete',
      emptyTitle: 'No projects',
      emptyHint: 'Create your first project',
      projectNameDefault: 'New project',
    },
    editor: {
      title: 'Editor',
      backToProjects: 'Back',
      save: 'Save',
      saving: 'Saving...',
      publish: 'Publish',
      preview: 'Preview',
      hidePreview: 'Hide Preview',
      addBlock: 'Add Block',
      blockTypes: {
        message: 'Message',
        menu: 'Menu',
        input: 'Input',
        start: 'Start',
      },
      blockLabels: {
        message: 'Text Message',
        menu: 'Button Menu',
        input: 'Data Request',
        start: 'Dialog Start',
      },
      placeholders: {
        message: 'Enter message text...',
        menu: 'Choose an option:',
        input: 'Enter your answer:',
        start: 'Welcome!',
        buttonText: 'Button text',
      },
      jumpTo: 'Jump to:',
      noNext: 'End of flow',
      nextBlock: 'Next block',
      addButton: '+ Add button',
      editButtons: 'Edit Buttons',
      deleteBlock: 'Delete block',
      deleteConfirm: 'Delete this block?',
      blockNumber: 'Block #',
      dragHint: 'Drag to reorder',
      connectTo: 'Connect to:',
      validation: {
        noStart: 'Add a "Start" block',
        emptyContent: 'Fill in block content',
        noButtons: 'Add at least one button',
        invalidTransition: 'Invalid block connection',
      },
    },
    sync: {
      saving: 'Saving...',
      saved: 'Saved',
      error: 'Sync error',
      offline: 'Offline',
      retry: 'Retry',
      conflict: 'Version conflict',
      conflictMessage: 'Schema was changed on server',
      loadServer: 'Load from server',
      keepLocal: 'Keep my version',
    },
    errors: {
      network: 'Network error. Check your connection.',
      validation: 'Validation error',
      conflict: 'Version conflict. Refresh the page.',
      unknown: 'Unknown error',
    },
    publish: {
      title: 'Publish',
      subtitle: 'Connect to Telegram',
      description: 'Enter the API token from @BotFather in Telegram.',
      botToken: 'API Token',
      tokenPlaceholder: '000000000:AAHHH...',
      deploy: 'Deploy Bot',
      deploying: 'Deploying...',
      success: 'Success!',
      successMessage: 'Bot is live!',
      backToEditor: 'Back to Editor',
    },
    simulator: {
      liveMode: 'Live Mode', // EN: 'Live Mode'
      restart: 'Restart', // EN: 'Restart'
      userInputPlaceholder: 'User input here...', // EN: 'User input here...'
      send: 'Send', // EN: 'Send'
      typeMessage: 'Type message...', // EN: 'Type message...'
      noStartBlock: 'Add a "Start" block to begin', // EN: 'Add a "Start" block to begin'
      endOfFlow: 'End of conversation', // EN: 'End of conversation'
    },
    templates: {
      title: 'Templates Gallery',
      subtitle: 'Choose a template',
      backToHome: 'Back',
      useTemplate: 'Use Template',
      blankProject: 'Blank Project',
      blankDescription: 'Start from scratch',
      bricksCount: 'blocks',
    },
    leads: {
      title: 'Leads',
    },
    store: {
      title: 'Subscription',
      freeFeatures: ['1 bot', 'Basic blocks', 'Analytics'],
      premiumFeatures: ['5 bots', 'Smart logic', 'Branding', 'CRM'],
      free: {
        name: 'Free',
        price: 'Free',
        description: 'Basic access',
      },
      premium: {
        name: 'Premium',
        price: 'Premium',
        description: 'Higher limits',
      },
      active: 'Active',
      choose: 'Choose',
      features: {
        projects: 'Projects',
        bricks: 'Bricks per project',
        support: 'Support',
      },
      support: {
        basic: 'Basic',
        premium: 'Premium',
      },
    },
    settings: {
      title: 'Settings',
      profileName: 'Architect',
      theme: 'Theme',
      security: 'Security',
      billing: 'Billing',
      notifications: 'Notifications',
      logout: 'Log out',
    },
    limit: {
      title: 'Limit reached',
      description: 'You have reached the projects limit. Upgrade your subscription to increase limits.',
      subscription: 'Subscription',
      later: 'Later',
    },
  },
};
