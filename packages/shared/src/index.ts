// Shared types and utilities
// For browser bundles use "@dialogue-constructor/shared/browser"; for server use "@dialogue-constructor/shared" or "@dialogue-constructor/shared/server".
import { createLogger } from './logger';

export const logger = createLogger('shared');

export * from './logger';
export * from './middleware';
export * from './constants/limits';
export * from './types/bot-schema';
export * from './services/telegram';
export * from './utils/circuit-breaker';
export * from './utils/graceful-degradation';
export * from './utils/sanitize';
export * from './utils/telegram-auth';
export * from './validation/bot-schema-validation';
export * from './validation/schemas';
export * from './db/bot-users';
export * from './db/bot-analytics';
export * from './env/getTelegramBotToken';

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

