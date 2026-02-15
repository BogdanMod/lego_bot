import axios from 'axios';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';

export interface SetWebhookResponse {
  ok: boolean;
  description?: string;
  result?: boolean;
}

/**
 * Установить webhook для бота
 */
export async function setWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken?: string,
  allowedUpdates?: string[]
): Promise<SetWebhookResponse> {
  // Validate bot token format
  if (!botToken || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
    throw new Error('Invalid bot token format. Expected format: <bot_id>:<token>');
  }

  try {
    const url = `${TELEGRAM_API_BASE_URL}${botToken}/setWebhook`;

    const requestBody: {
      url: string;
      secret_token?: string;
      allowed_updates?: string[];
    } = {
      url: webhookUrl,
    };

    if (secretToken) {
      requestBody.secret_token = secretToken;
    }

    if (allowedUpdates !== undefined) {
      requestBody.allowed_updates = allowedUpdates;
    }

    const response = await axios.post(
      url,
      requestBody,
      {
        timeout: 10000,
        validateStatus: (status) => status < 500, // Don't throw on 4xx
      }
    );

    if (response.status === 404) {
      throw new Error('Bot token not found. Check TELEGRAM_BOT_TOKEN environment variable.');
    }

    if (!response.data.ok) {
      const errorCode = response.data.error_code;
      const description = response.data.description || 'Failed to set webhook';
      
      if (errorCode === 401) {
        throw new Error('Unauthorized: Invalid bot token');
      }
      if (errorCode === 404) {
        throw new Error('Bot not found: Token may be invalid or bot was deleted');
      }
      
      throw new Error(`Telegram API error (${errorCode}): ${description}`);
    }

    return {
      ok: true,
      result: response.data.result,
      description: response.data.description,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Bot token not found. Check TELEGRAM_BOT_TOKEN environment variable.');
      }
      const errorMessage = error.response?.data?.description || error.message;
      const errorCode = error.response?.data?.error_code;
      throw new Error(`Failed to set webhook${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`);
    }
    throw error;
  }
}

/**
 * Удалить webhook для бота
 */
export async function deleteWebhook(botToken: string): Promise<SetWebhookResponse> {
  try {
    const url = `${TELEGRAM_API_BASE_URL}${botToken}/deleteWebhook`;
    
    const response = await axios.post(
      url,
      {
        drop_pending_updates: false,
      },
      {
        timeout: 10000,
      }
    );

    if (!response.data.ok) {
      throw new Error(response.data.description || 'Failed to delete webhook');
    }

    return {
      ok: true,
      result: response.data.result,
      description: response.data.description,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.description || error.message;
      throw new Error(`Failed to delete webhook: ${errorMessage}`);
    }
    throw error;
  }
}

/**
 * Получить информацию о webhook
 */
export async function getWebhookInfo(botToken: string): Promise<any> {
  // Validate bot token format
  if (!botToken || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
    throw new Error('Invalid bot token format. Expected format: <bot_id>:<token>');
  }

  try {
    const url = `${TELEGRAM_API_BASE_URL}${botToken}/getWebhookInfo`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Don't throw on 4xx
    });

    if (response.status === 404) {
      throw new Error('Bot token not found. Check TELEGRAM_BOT_TOKEN environment variable.');
    }

    if (!response.data.ok) {
      const errorCode = response.data.error_code;
      const description = response.data.description || 'Failed to get webhook info';
      
      if (errorCode === 401) {
        throw new Error('Unauthorized: Invalid bot token');
      }
      if (errorCode === 404) {
        throw new Error('Bot not found: Token may be invalid or bot was deleted');
      }
      
      throw new Error(`Telegram API error (${errorCode}): ${description}`);
    }

    return response.data.result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Bot token not found. Check TELEGRAM_BOT_TOKEN environment variable.');
      }
      const errorMessage = error.response?.data?.description || error.message;
      const errorCode = error.response?.data?.error_code;
      throw new Error(`Failed to get webhook info${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`);
    }
    throw error;
  }
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Получить информацию о webhook с форматированием
 */
export async function getWebhookInfoFormatted(botToken: string): Promise<{
  ok: boolean;
  info?: WebhookInfo;
  error?: string;
}> {
  try {
    const info = await getWebhookInfo(botToken);
    return { ok: true, info };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, error: errorMessage };
  }
}

export interface MenuButtonWebApp {
  type: 'web_app';
  text: string;
  web_app: {
    url: string;
  };
}

export interface SetMenuButtonResponse {
  ok: boolean;
  description?: string;
  result?: boolean;
}

/**
 * Настроить кнопку меню для Mini App
 */
export async function setBotMenuButton(
  botToken: string,
  menuButtonText: string,
  webAppUrl: string,
  chatId?: number
): Promise<SetMenuButtonResponse> {
  try {
    const url = `${TELEGRAM_API_BASE_URL}${botToken}/setChatMenuButton`;

    const menuButton: MenuButtonWebApp = {
      type: 'web_app',
      text: menuButtonText,
      web_app: {
        url: webAppUrl,
      },
    };

    const requestBody: { chat_id?: number; menu_button: MenuButtonWebApp } = {
      menu_button: menuButton,
    };

    if (chatId !== undefined) {
      requestBody.chat_id = chatId;
    }

    const response = await axios.post(url, requestBody, {
      timeout: 10000,
    });

    if (!response.data.ok) {
      throw new Error(response.data.description || 'Failed to set menu button');
    }

    return {
      ok: true,
      result: response.data.result,
      description: response.data.description,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.description || error.message;
      throw new Error(`Failed to set menu button: ${errorMessage}`);
    }
    throw error;
  }
}

