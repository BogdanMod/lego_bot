/**
 * Base template utilities
 * Common functions for all templates
 */

import type { BotSchema, BotConfig, TemplateAnswers } from './types';
import { substitute, substituteInSchema, patchWithModule } from './engine';

/**
 * Create minimal bot config (empty bot)
 */
export function createEmptyBotConfig(name: string, answers: TemplateAnswers): BotConfig {
  const schema: BotSchema = {
    version: 1,
    initialState: 'start',
    states: {
      start: {
        message: substitute(
          `Добро пожаловать в {{businessName}}!\n\nЧем можем помочь?`,
          { ...answers, businessName: name }
        ),
        buttons: [
          { text: '💬 Помощь', nextState: 'help' },
        ],
      },
      help: {
        message: 'Для связи с администратором оставьте ваш вопрос.',
        buttons: [
          { text: '⬅️ Назад', nextState: 'start' },
        ],
      },
    },
  };
  
  return {
    schema,
    metadata: {},
  };
}

/**
 * Apply modules to bot config
 */
export function applyModules(
  config: BotConfig,
  enabledModules: string[],
  answers: TemplateAnswers
): BotConfig {
  let result = config;
  
  for (const moduleId of enabledModules) {
    result = patchWithModule(result, moduleId, answers);
  }
  
  return result;
}

/**
 * Finalize bot config: substitute all variables and apply modules
 */
export function finalizeBotConfig(
  config: BotConfig,
  answers: TemplateAnswers,
  enabledModules: string[] = []
): BotConfig {
  // Substitute variables
  const withSubstitutions: BotConfig = {
    ...config,
    schema: substituteInSchema(config.schema, answers),
  };
  
  // Apply modules
  return applyModules(withSubstitutions, enabledModules, answers);
}

