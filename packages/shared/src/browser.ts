// Types
export * from './types/bot-schema-browser';
export * from './types/analytics';
export * from './types/owner';

// Constants
export * from './constants/limits-browser';

// Validation schemas (Zod - browser-safe)
// validateBotSchema is server-only and intentionally not exported here.
// Import first, then re-export explicitly for Rollup/Vite compatibility
import {
  UpdateBotSchemaSchema,
  CreateBotSchema,
  BotIdSchema,
  UserIdSchema,
  PaginationSchema,
  CreateBroadcastSchema,
  BroadcastIdSchema,
  UpdateBroadcastStatusSchema,
  TelegramUpdateSchema,
} from './validation/schemas.js';

// Re-export explicitly to ensure Rollup can resolve exports
export {
  UpdateBotSchemaSchema,
  CreateBotSchema,
  BotIdSchema,
  UserIdSchema,
  PaginationSchema,
  CreateBroadcastSchema,
  BroadcastIdSchema,
  UpdateBroadcastStatusSchema,
  TelegramUpdateSchema,
};

// Browser-safe utilities
export { sanitizeHtml, sanitizeText, sanitizeBotSchema } from './utils/sanitize';

// Explicit re-exports for better type visibility
export type { BotSchema, BotButton, NavigationButton, RequestContactButton, RequestEmailButton, UrlButton, MediaContent, MediaGroupItem, WebhookConfig, IntegrationTemplate } from './types/bot-schema-browser';

// Shared interfaces
export interface User {
  id: number;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bot {
  id: string;
  token: string;
  name: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dialogue {
  id: string;
  botId: string;
  name: string;
  nodes: DialogueNode[];
  edges: DialogueEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DialogueNode {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action';
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface DialogueEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}
