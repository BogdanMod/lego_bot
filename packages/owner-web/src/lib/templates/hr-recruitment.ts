/**
 * HR Recruitment Template
 */

import type { BotSchema, TemplateDefinition, TemplateAnswers, BotConfig } from './types';
import { finalizeBotConfig } from './base';

const manifest = {
  id: 'hr_recruitment',
  name: 'HR / Подбор персонала',
  description: 'Сбор кандидатов',
  icon: '👔',
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
          label: 'Название компании',
          type: 'text' as const,
          required: true,
          placeholder: 'Например: HR-агентство "Кадры"',
        },
        {
          id: 'address',
          label: 'Адрес офиса',
          type: 'text' as const,
          required: false,
        },
        {
          id: 'contactPhone',
          label: 'Контактный телефон',
          type: 'phone' as const,
          required: true,
        },
        {
          id: 'vacancies',
          label: 'Типы вакансий',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: IT, продажи, менеджмент',
        },
      ],
    },
    {
      id: 'offer',
      title: 'Оффер',
      fields: [
        {
          id: 'offerDescription',
          label: 'Краткое описание',
          type: 'textarea' as const,
          required: false,
          placeholder: 'Например: Подбор персонала, рекрутинг, HR-консалтинг',
        },
      ],
    },
  ],
  modules: {
    handoff: true,
    schedule: false,
    faq: true,
    payments: false,
    catalog: false,
    leads: true,
  },
};

function buildBotConfig(answers: TemplateAnswers): BotConfig {
  const schema: BotSchema = {
    version: 1,
    initialState: 'start',
    states: {
      start: {
        message: `Добро пожаловать в {{businessName}}! 👔\n\nЧем можем помочь?`,
        buttons: [
          { text: '💼 Посмотреть вакансии', nextState: 'vacancies' },
          { text: '📝 Откликнуться', nextState: 'apply' },
          { text: '📞 Связаться', nextState: 'contacts' },
        ],
      },
      vacancies: {
        message: '💼 Актуальные вакансии:\n\n{{vacancies}}\n\nДля отклика нажмите "Откликнуться"!',
        buttons: [
          { text: '📝 Откликнуться', nextState: 'apply' },
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
      apply: {
        message: '📝 Для отклика на вакансию укажите:\n• Желаемую позицию\n• Опыт работы\n• Контактные данные\n\nМы свяжемся с вами!',
        buttons: [
          { text: '📝 Отправить отклик', nextState: 'leads' },
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
        message: 'Не понял ваш вопрос. Выберите один из вариантов выше или свяжитесь с HR-менеджером.',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
    },
  };
  
  const enabledModules: string[] = [];
  if (answers.enableHandoff) enabledModules.push('handoff');
  if (answers.enableFaq) enabledModules.push('faq');
  if (answers.enableLeads) enabledModules.push('leads');
  
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

export const hrRecruitmentTemplate: TemplateDefinition = {
  manifest,
  wizard,
  buildBotConfig,
};

