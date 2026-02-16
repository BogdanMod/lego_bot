import {
  BotSchema,
  BotButton,
  UrlButton,
  AnalyticsEvent,
  AnalyticsStats,
  PopularPath,
  FunnelStep,
  TimeSeriesData,
  MediaContent,
} from '@dialogue-constructor/shared/browser';

export interface Bot {
  id: string;
  name: string;
  webhook_set: boolean;
  schema_version: number;
  created_at: string;
}

export type BotSummary = Bot;

export interface BotWithSchema extends Bot {
  schema: BotSchema | null;
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface BotUser {
  id: string;
  bot_id: string;
  telegram_user_id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  phone_number?: string;
  email?: string;
  language_code?: string;
  first_interaction_at: string;
  last_interaction_at: string;
  interaction_count: number;
}

export interface Broadcast {
  id: string;
  bot_id: string;
  name: string;
  message: string;
  media?: MediaContent;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  status: 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface BroadcastStats {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  clicks: number;
  engaged: number;
  progress: number;
}

export interface CreateBroadcastData {
  name: string;
  message: string;
  media?: MediaContent;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  scheduledAt?: string;
}

export type { BotSchema, BotButton, UrlButton, AnalyticsEvent, AnalyticsStats, PopularPath, FunnelStep, TimeSeriesData, MediaContent };


// Brick-based model types (новая модель для UI)
export type BrickType = 'message' | 'menu' | 'input' | 'start';

export type SubscriptionType = 'Free' | 'Premium';

export interface MenuOption {
  text: string;
  targetId?: string; // ID блока для перехода
}

export interface Brick {
  id: string;
  type: BrickType;
  content: string;
  options?: MenuOption[]; // Только для type='menu'
  nextId?: string; // Для автоматического перехода (message, input, start)
}

export interface BotProject {
  id: string;
  name: string;
  bricks: Brick[];
  lastModified: number;
  status: 'draft' | 'live';
  botToken?: string;
  themeColor?: string;
  serverId?: string;
}

export type Theme = 'light' | 'dark';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type BadgeVariant = 'success' | 'error' | 'warning' | 'info';

export type Language = 'RU' | 'EN';
export type MainTab = 'home' | 'bots' | 'store' | 'settings';

export interface AdminStats {
  totalUsers: number;
  activeUsersLast7d: number;
  joinedLast7d: number;
  joinedLast30d: number;
  activeSubscriptions: number;
  paidSubscriptions: number;
  retentionDay1: number;
  retentionDay7: number;
  retentionDay30: number;
  conversionToPaid: number;
  arpuUsd30d: number;
  estimatedRevenueUsd30d: number;
}

export interface PromoCode {
  id: string;
  code: string;
  durationDays: number;
  maxRedemptions: number;
  redemptionCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface PromoRedeemResult {
  telegramUserId: string;
  promoCode: string;
  startsAt: string;
  endsAt: string | null;
  plan: string;
}

export interface AdminSubscriptionGrantResult {
  telegramUserId: string;
  startsAt: string;
  endsAt: string | null;
  plan: string;
  source: string;
  grantedBy: string | null;
}
