/**
 * AI-powered BotSchema generation from wizard answers.
 * Uses OpenAI Chat Completions (optional: env OPENAI_API_KEY).
 * Output is validated with validateBotSchema before return.
 */

import { validateBotSchema } from '@dialogue-constructor/shared/server';
import type { BotSchema } from '@dialogue-constructor/shared';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export type GenerateSchemaInput = Record<string, string>;

export type GenerateSchemaResult =
  | { ok: true; schema: BotSchema }
  | { ok: false; error: string; errors?: string[] };

function buildPrompt(answers: GenerateSchemaInput): string {
  const parts = Object.entries(answers)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`);
  const context = parts.length > 0 ? parts.join('\n') : 'Нет дополнительных ответов.';

  return `Ты генерируешь JSON-схему диалогового бота для Telegram. Схема должна быть полезной и не примитивной.

Формат (TypeScript):
interface BotSchema {
  version: 1;
  initialState: string;
  states: {
    [key: string]: {
      message: string;
      buttons?: Array<
        | { text: string; nextState: string; track?: { event: 'lead' | 'appointment' } }
        | { type: 'request_contact'; text: string; nextState: string; track?: { event: 'lead' } }
      >;
      track?: { event: 'lead' | 'appointment' };
    };
  };
}

Правила:
- version всегда 1. Ключи states — латиницей (start, menu, drinks, drink_coffee, order, help, goodbye, thanks, confirm).
- Сообщения на русском: развёрнутые, дружелюбные, по контексту. Не одно слово — минимум 1–2 предложения там, где уместно.
- Сделай 6–12 состояний. Логичный поток: приветствие (start) → главное меню или каталог → по нажатию кнопки переход к экрану с описанием/подробностями → кнопки «Назад», «В главное меню» где нужно.
- В приветствии кратко объясни, что умеет бот. В меню — понятные кнопки (например напитки, услуги, контакты, помощь).
- Кнопок не более 8 на один экран (лимит Telegram). nextState — ключ из states.
- Обязательно включи минимум один сценарий «Заявка» с кнопкой type "request_contact":
  1) State для сбора контакта (например lead_contact): message про «поделиться номером», одна кнопка { "type": "request_contact", "text": "Поделиться номером", "nextState": "lead_thanks", "track": { "event": "lead" } } и при необходимости «Назад».
  2) Финальный state lead_thanks (или thanks): сообщение «Спасибо, мы получили ваш номер. Менеджер свяжется…», кнопка «В главное меню», у state задай track: { "event": "lead" }.
- Остальные финальные экраны: track: { "event": "lead" } для заявок, track: { "event": "appointment" } для записи на время/услугу.
- Кнопки могут быть: обычная (text, nextState), url (text, url), request_contact (type, text, nextState, track). У request_contact обязательно track: { "event": "lead" }.
- Ответь ТОЛЬКО валидным JSON, без markdown и пояснений.

Контекст от пользователя:
${context}

Верни один JSON-объект схемы бота.`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as unknown;
  }
  return JSON.parse(trimmed) as unknown;
}

export async function generateSchemaFromAnswers(answers: GenerateSchemaInput): Promise<GenerateSchemaResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'AI schema generation is not configured (OPENAI_API_KEY)' };
  }

  const prompt = buildPrompt(answers);

  let raw: string;
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SCHEMA_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You output only valid JSON. No markdown, no code fences, no explanation.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `LLM request failed: ${response.status} ${errText.slice(0, 200)}` };
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: 'Empty LLM response' };
    }
    raw = content;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `LLM request error: ${message}` };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON in LLM response', errors: [raw.slice(0, 300)] };
  }

  const validation = validateBotSchema(parsed);
  if (!validation.valid) {
    return { ok: false, error: 'Generated schema failed validation', errors: validation.errors };
  }

  return { ok: true, schema: parsed as BotSchema };
}
