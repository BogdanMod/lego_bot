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
  webhookUrl: string
): Promise<SetWebhookResponse> {
  try {
    const url = `${TELEGRAM_API_BASE_URL}${botToken}/setWebhook`;
    
    const response = await axios.post(
      url,
      {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      },
      {
        timeout: 10000,
      }
    );

    if (!response.data.ok) {
      throw new Error(response.data.description || 'Failed to set webhook');
    }

    return {
      ok: true,
      result: response.data.result,
      description: response.data.description,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.description || error.message;
      throw new Error(`Failed to set webhook: ${errorMessage}`);
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
  try {
    const url = `${TELEGRAM_API_BASE_URL}${botToken}/getWebhookInfo`;
    
    const response = await axios.get(url, {
      timeout: 10000,
    });

    if (!response.data.ok) {
      throw new Error(response.data.description || 'Failed to get webhook info');
    }

    return response.data.result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.description || error.message;
      throw new Error(`Failed to get webhook info: ${errorMessage}`);
    }
    throw error;
  }
}

