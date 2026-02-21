/**
 * Template Engine
 * Handles variable substitution and module patching
 */

import type { BotSchema, TemplateAnswers, BotConfig } from './types';

/**
 * Substitute variables in text: {{varName}} -> value
 */
export function substitute(text: string, answers: TemplateAnswers): string {
  if (typeof text !== 'string') return text;
  
  let result = text;
  for (const [key, value] of Object.entries(answers)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const stringValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    result = result.replace(placeholder, stringValue);
  }
  
  return result;
}

/**
 * Substitute in all messages of a schema
 */
export function substituteInSchema(schema: BotSchema, answers: TemplateAnswers): BotSchema {
  const cloned = JSON.parse(JSON.stringify(schema)) as BotSchema;
  
  for (const stateKey in cloned.states) {
    const state = cloned.states[stateKey];
    if (state.message) {
      state.message = substitute(state.message, answers);
    }
    if (state.buttons) {
      state.buttons = state.buttons.map((btn: { text: string; nextState: string; [key: string]: unknown }) => ({
        ...btn,
        text: substitute(btn.text, answers),
      }));
    }
  }
  
  return cloned;
}

/**
 * Patch bot config with module-specific changes
 */
export function patchWithModule(
  config: BotConfig,
  moduleId: string,
  answers: TemplateAnswers
): BotConfig {
  const patched = JSON.parse(JSON.stringify(config)) as BotConfig;
  
  switch (moduleId) {
    case 'handoff':
      // Add handoff state that transfers to admin
      if (!patched.schema.states.handoff) {
        patched.schema.states.handoff = {
          message: substitute(
            'Свяжу вас с администратором. Опишите ваш вопрос, и мы ответим в ближайшее время.',
            answers
          ),
          buttons: [{ text: '⬅️ Назад', nextState: patched.schema.initialState }],
        };
      }
      // Add handoff button to start state if not exists
      const startState = patched.schema.states[patched.schema.initialState];
      if (startState && !startState.buttons?.some((b: { nextState: string }) => b.nextState === 'handoff')) {
        startState.buttons = [
          ...(startState.buttons || []),
          { text: '💬 Связаться с администратором', nextState: 'handoff' },
        ];
      }
      break;
      
    case 'schedule': {
      const initial = patched.schema.initialState;
      // Шаг «Поделиться номером» (request_contact) — обязательный для заявки
      if (!patched.schema.states.lead_contact) {
        patched.schema.states.lead_contact = {
          message: 'Нажмите кнопку ниже, чтобы поделиться номером.',
          buttons: [
            {
              type: 'request_contact',
              text: 'Поделиться номером',
              nextState: 'lead_thanks',
              track: { event: 'lead' },
            },
          ],
        };
      }
      if (!patched.schema.states.lead_thanks) {
        patched.schema.states.lead_thanks = {
          message:
            'Спасибо, мы получили ваш номер. Менеджер свяжется с вами в ближайшее время для подтверждения.',
          buttons: [
            { text: 'В главное меню', nextState: initial },
          ],
          track: { event: 'lead' },
        };
      }
      if (!patched.schema.states.schedule) {
        patched.schema.states.schedule = {
          message: substitute(
            'Для записи укажите желаемое время и дату. Мы свяжемся с вами для подтверждения.',
            answers
          ),
          buttons: [{ text: '⬅️ Назад', nextState: initial }],
          track: { event: 'appointment' },
        };
      }
      break;
    }
      
    case 'faq':
      // Add FAQ state with common questions
      if (!patched.schema.states.faq) {
        const faqItems = (answers.faqItems as string[]) || [];
        const faqText = faqItems.length > 0
          ? `Частые вопросы:\n\n${faqItems.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          : 'Частые вопросы будут добавлены позже.';
        
        patched.schema.states.faq = {
          message: substitute(faqText, answers),
          buttons: [{ text: '⬅️ Назад', nextState: patched.schema.initialState }],
        };
      }
      break;
      
    case 'payments':
      // Add payment state
      if (!patched.schema.states.payment) {
        patched.schema.states.payment = {
          message: substitute(
            'Для оплаты свяжитесь с нами: {{contactPhone}}',
            answers
          ),
          buttons: [{ text: '⬅️ Назад', nextState: patched.schema.initialState }],
        };
      }
      break;
      
    case 'catalog':
      // Add catalog state
      if (!patched.schema.states.catalog) {
        patched.schema.states.catalog = {
          message: substitute(
            'Каталог товаров/услуг:\n\n{{catalogItems}}',
            answers
          ),
          buttons: [{ text: '⬅️ Назад', nextState: patched.schema.initialState }],
        };
      }
      break;
      
    case 'leads': {
      const initial = patched.schema.initialState;
      if (!patched.schema.states.lead_contact) {
        patched.schema.states.lead_contact = {
          message: 'Нажмите кнопку ниже, чтобы поделиться номером.',
          buttons: [
            {
              type: 'request_contact',
              text: 'Поделиться номером',
              nextState: 'lead_thanks',
              track: { event: 'lead' },
            },
          ],
        };
      }
      if (!patched.schema.states.lead_thanks) {
        patched.schema.states.lead_thanks = {
          message:
            'Спасибо, мы получили ваш номер. Менеджер свяжется с вами в ближайшее время.',
          buttons: [{ text: 'В главное меню', nextState: initial }],
          track: { event: 'lead' },
        };
      }
      break;
    }
  }
  
  return patched;
}

/**
 * Validate answers against wizard fields
 */
export function validateAnswers(
  answers: TemplateAnswers,
  fields: Array<{ id: string; required?: boolean; validation?: { min?: number; max?: number; pattern?: string } }>
): { valid: boolean; errors: Array<{ field: string; message: string }> } {
  const errors: Array<{ field: string; message: string }> = [];
  
  for (const field of fields) {
    const value = answers[field.id];
    
    if (field.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
      errors.push({ field: field.id, message: `Поле "${field.id}" обязательно для заполнения` });
      continue;
    }
    
    if (value !== undefined && value !== null && field.validation) {
      if (typeof value === 'string') {
        if (field.validation.min && value.length < field.validation.min) {
          errors.push({ field: field.id, message: `Минимальная длина: ${field.validation.min}` });
        }
        if (field.validation.max && value.length > field.validation.max) {
          errors.push({ field: field.id, message: `Максимальная длина: ${field.validation.max}` });
        }
        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push({ field: field.id, message: 'Неверный формат' });
          }
        }
      }
      if (typeof value === 'number') {
        if (field.validation.min !== undefined && value < field.validation.min) {
          errors.push({ field: field.id, message: `Минимальное значение: ${field.validation.min}` });
        }
        if (field.validation.max !== undefined && value > field.validation.max) {
          errors.push({ field: field.id, message: `Максимальное значение: ${field.validation.max}` });
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

