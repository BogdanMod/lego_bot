import axios from 'axios';

type WebhookPayload = {
  timestamp: string;
  user_id: number;
  user?: {
    first_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null;
};

type GoogleSheetsConfig = {
  spreadsheetUrl: string;
  sheetName?: string;
  columns?: string[];
};

export async function sendToGoogleSheets(
  config: GoogleSheetsConfig,
  payload: WebhookPayload,
  timeoutMs = 10000
): Promise<{ status: number; response: unknown }> {
  const body = {
    values: [
      [
        payload.timestamp,
        payload.user_id,
        payload.user?.first_name ?? null,
        payload.user?.phone_number ?? null,
        payload.user?.email ?? null,
      ],
    ],
    sheetName: config.sheetName,
    columns: config.columns,
  };

  const response = await axios.post(config.spreadsheetUrl, body, {
    timeout: timeoutMs,
    validateStatus: () => true,
  });
  return { status: response.status, response: response.data };
}
