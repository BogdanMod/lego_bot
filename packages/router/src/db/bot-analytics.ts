import type { Logger } from '@dialogue-constructor/shared';
import { AnalyticsEventData, logAnalyticsEventWithClient } from '@dialogue-constructor/shared';
import { getPostgresClient } from './postgres';

export async function logAnalyticsEvent(
  botId: string,
  telegramUserId: string | number,
  sourceUpdateId: string | number,
  eventType: string,
  data: AnalyticsEventData = {},
  logger?: Logger
): Promise<void> {
  const client = await getPostgresClient();
  try {
    await logAnalyticsEventWithClient(
      client,
      botId,
      telegramUserId,
      sourceUpdateId,
      eventType,
      data
    );
  } catch (error) {
    logger?.warn({ botId, telegramUserId, eventType, error }, 'Failed to log analytics event');
  } finally {
    client.release();
  }
}
