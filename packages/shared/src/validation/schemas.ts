import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize';

export const CreateBotSchema = z.object({
  token: z.string().regex(/^\d+:[A-Za-z0-9_-]{35}$/),
  name: z.string().min(1).max(100).transform(sanitizeText),
});

const ButtonSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object') {
      return value;
    }
    const button = value as { type?: unknown };
    if (button.type === undefined) {
      return { ...button, type: 'navigation' };
    }
    return button;
  },
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('navigation'),
      text: z.string().transform(sanitizeText),
      nextState: z.string(),
    }),
    z.object({
      type: z.literal('url'),
      text: z.string().transform(sanitizeText),
      url: z.string(),
    }),
    z.object({
      type: z.literal('request_contact'),
      text: z.string().transform(sanitizeText),
      nextState: z.string(),
    }),
    z.object({
      type: z.literal('request_email'),
      text: z.string().transform(sanitizeText),
      nextState: z.string(),
    }),
  ])
);

const WebhookConfigSchema = z.object({
  url: z.string(),
  method: z.enum(['POST', 'GET']).optional(),
  headers: z.record(z.string()).optional(),
  signingSecret: z.string().optional(),
  enabled: z.boolean(),
  retryCount: z.number().int().nonnegative().optional(),
  timeout: z.number().int().positive().optional(),
});

const IntegrationTemplateSchema = z.object({
  type: z.enum(['google_sheets', 'telegram_channel', 'custom']),
  config: z.record(z.any()),
});

const MediaSchema = z.object({
  type: z.enum(['photo', 'video', 'document', 'audio']),
  url: z.string(),
  caption: z.string().optional(),
  thumbnail: z.string().optional(),
  cover: z.string().optional(),
});

const MediaGroupItemSchema = z.object({
  type: z.enum(['photo', 'video']),
  url: z.string(),
  caption: z.string().optional(),
});

const StateSchema = z.object({
  message: z.string().transform(sanitizeText),
  media: MediaSchema.optional(),
  mediaGroup: z.array(MediaGroupItemSchema).optional(),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  buttons: z.array(ButtonSchema).optional(),
  webhook: WebhookConfigSchema.optional(),
  integration: IntegrationTemplateSchema.optional(),
});

export const UpdateBotSchemaSchema = z.object({
  version: z.literal(1),
  states: z.record(StateSchema),
  initialState: z.string(),
});

export const BotIdSchema = z.string().uuid();

export const UserIdSchema = z.number().int().positive();

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const CreateBroadcastSchema = z.object({
  name: z.string().min(1).max(200).transform(sanitizeText),
  message: z.string().min(1).max(4096).transform(sanitizeText),
  media: MediaSchema.optional(),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const BroadcastIdSchema = z.string().uuid();

export const UpdateBroadcastStatusSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'processing', 'completed', 'cancelled']),
});

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      from: z
        .object({
          id: z.number(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          username: z.string().optional(),
          language_code: z.string().optional(),
        })
        .optional(),
      chat: z.object({
        id: z.number(),
      }),
      text: z.string().optional(),
      contact: z
        .object({
          phone_number: z.string(),
          first_name: z.string(),
          last_name: z.string().optional(),
          user_id: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: z.object({
        id: z.number(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        username: z.string().optional(),
        language_code: z.string().optional(),
      }),
      message: z
        .object({
          message_id: z.number(),
          chat: z.object({
            id: z.number(),
          }),
        })
        .optional(),
      data: z.string(),
    })
    .optional(),
}).passthrough();
