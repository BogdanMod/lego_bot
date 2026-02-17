/**
 * Template Engine Tests
 */

import { substitute, substituteInSchema, validateAnswers, patchWithModule } from '../engine';
import type { TemplateAnswers, BotConfig } from '../types';

describe('Template Engine', () => {
  describe('substitute', () => {
    it('should substitute variables in text', () => {
      const text = 'Добро пожаловать в {{businessName}}!';
      const answers: TemplateAnswers = { businessName: 'Моя кофейня' };
      expect(substitute(text, answers)).toBe('Добро пожаловать в Моя кофейня!');
    });

    it('should handle multiple variables', () => {
      const text = '{{businessName}} - {{address}}';
      const answers: TemplateAnswers = { businessName: 'Кафе', address: 'Москва' };
      expect(substitute(text, answers)).toBe('Кафе - Москва');
    });

    it('should handle missing variables', () => {
      const text = '{{businessName}}';
      const answers: TemplateAnswers = {};
      expect(substitute(text, answers)).toBe('');
    });

    it('should handle arrays', () => {
      const text = '{{items}}';
      const answers: TemplateAnswers = { items: ['a', 'b', 'c'] };
      expect(substitute(text, answers)).toBe('a, b, c');
    });
  });

  describe('substituteInSchema', () => {
    it('should substitute in all messages', () => {
      const schema = {
        version: 1 as const,
        initialState: 'start',
        states: {
          start: {
            message: 'Добро пожаловать в {{businessName}}!',
            buttons: [],
          },
        },
      };
      const answers: TemplateAnswers = { businessName: 'Кафе' };
      const result = substituteInSchema(schema, answers);
      expect(result.states.start.message).toBe('Добро пожаловать в Кафе!');
    });

    it('should substitute in button texts', () => {
      const schema = {
        version: 1 as const,
        initialState: 'start',
        states: {
          start: {
            message: 'Hello',
            buttons: [
              { text: '{{buttonText}}', nextState: 'next' },
            ],
          },
        },
      };
      const answers: TemplateAnswers = { buttonText: 'Нажми' };
      const result = substituteInSchema(schema, answers);
      expect(result.states.start.buttons?.[0].text).toBe('Нажми');
    });
  });

  describe('validateAnswers', () => {
    it('should validate required fields', () => {
      const fields = [
        { id: 'name', required: true },
        { id: 'email', required: false },
      ];
      const answers: TemplateAnswers = {};
      const result = validateAnswers(answers, fields);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation for all required fields', () => {
      const fields = [
        { id: 'name', required: true },
        { id: 'email', required: false },
      ];
      const answers: TemplateAnswers = { name: 'Test' };
      const result = validateAnswers(answers, fields);
      expect(result.valid).toBe(true);
    });

    it('should validate min length', () => {
      const fields = [
        { id: 'name', required: true, validation: { min: 3 } },
      ];
      const answers: TemplateAnswers = { name: 'ab' };
      const result = validateAnswers(answers, fields);
      expect(result.valid).toBe(false);
    });

    it('should validate max length', () => {
      const fields = [
        { id: 'name', required: true, validation: { max: 5 } },
      ];
      const answers: TemplateAnswers = { name: 'very long name' };
      const result = validateAnswers(answers, fields);
      expect(result.valid).toBe(false);
    });
  });

  describe('patchWithModule', () => {
    it('should add handoff module', () => {
      const config: BotConfig = {
        schema: {
          version: 1,
          initialState: 'start',
          states: {
            start: {
              message: 'Hello',
              buttons: [],
            },
          },
        },
      };
      const answers: TemplateAnswers = {};
      const result = patchWithModule(config, 'handoff', answers);
      expect(result.schema.states.handoff).toBeDefined();
      expect(result.schema.states.start.buttons?.some(b => b.nextState === 'handoff')).toBe(true);
    });
  });
});

