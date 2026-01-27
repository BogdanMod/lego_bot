import axios from 'axios';

type WebhookPayload = {
  timestamp: string;
  user_id: number;
  state_key?: string;
  user?: {
    first_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null;
};

type TelegramChannelConfig = {
  channelId: string;
  messageTemplate?: string;
};

const renderTemplate = (template: string, payload: WebhookPayload) => {
  const replacements: Record<string, string> = {
    '{first_name}': payload.user?.first_name ?? '',
    '{phone_number}': payload.user?.phone_number ?? '',
    '{email}': payload.user?.email ?? '',
    '{user_id}': String(payload.user_id ?? ''),
    '{state_key}': payload.state_key ?? '',
    '{timestamp}': payload.timestamp ?? '',
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }
  return result;
};

export async function sendToTelegramChannel(
  config: TelegramChannelConfig,
  botToken: string,
  payload: WebhookPayload,
  timeoutMs = 10000
): Promise<{ status: number; response: unknown }> {
  const template = config.messageTemplate?.trim().length
    ? config.messageTemplate
    : 'Новая запись\n{first_name}\n{phone_number}\n{email}';
  const message = renderTemplate(template, payload);
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await axios.post(
    url,
    {
      chat_id: config.channelId,
      text: message,
    },
    {
      timeout: timeoutMs,
      validateStatus: () => true,
    }
  );
  return { status: response.status, response: response.data };
}
