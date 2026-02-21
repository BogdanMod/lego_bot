export interface WebhookConfig {
  url: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  signingSecret?: string;
  enabled: boolean;
  retryCount?: number;
  timeout?: number;
}

export interface IntegrationTemplate {
  type: 'google_sheets' | 'telegram_channel' | 'custom';
  config: Record<string, any>;
}

export type MediaContent = {
  type: 'photo' | 'video' | 'document' | 'audio';
  url: string;
  caption?: string;
  // future (multipart-only): thumbnail is ignored in URL-based sending
  thumbnail?: string;
  // video preview for URL-based sending
  cover?: string;
};

export type MediaGroupItem = {
  type: 'photo' | 'video';
  url: string;
  caption?: string;
};

export interface BotSchema {
  version: 1;
  states: {
    [key: string]: {
      message: string;
      media?: MediaContent;
      mediaGroup?: MediaGroupItem[];
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      buttons?: BotButton[];
      webhook?: WebhookConfig;
      integration?: IntegrationTemplate;
      /** Опционально: какое событие считать при входе в это состояние (lead/appointment). */
      track?: TrackEvent;
    };
  };
  initialState: string;
}

/** Опциональная разметка для аналитики: какое событие создавать при переходе (lead/appointment). */
export type TrackEvent = { event?: 'lead' | 'appointment' };

export type NavigationButton = {
  type?: 'navigation';
  text: string;
  nextState: string;
  track?: TrackEvent;
};

export type RequestContactButton = {
  type: 'request_contact';
  text: string;
  nextState: string;
  track?: TrackEvent;
};

export type RequestEmailButton = {
  type: 'request_email';
  text: string;
  nextState: string;
  track?: TrackEvent;
};

export type UrlButton = {
  type: 'url';
  text: string;
  url: string;
};

export type BotButton = NavigationButton | RequestContactButton | RequestEmailButton | UrlButton;
