import {
  AnalyticsEvent,
  AnalyticsEventsParams,
  AnalyticsStats,
  FunnelStep,
  PopularPath,
  TimeSeriesData,
  exportAnalyticsToCSVWithClient,
  getAnalyticsEventsWithClient,
  getAnalyticsStatsWithClient,
  getFunnelDataWithClient,
  getPopularPathsWithClient,
  getTimeSeriesDataWithClient,
} from '@dialogue-constructor/shared';
import { getPostgresClient } from './postgres';

export type {
  AnalyticsEvent,
  AnalyticsEventsParams,
  AnalyticsStats,
  FunnelStep,
  PopularPath,
  TimeSeriesData,
};

export async function getAnalyticsEvents(
  botId: string,
  userId: number,
  params: AnalyticsEventsParams
): Promise<{ events: AnalyticsEvent[]; nextCursor: string | null; hasMore: boolean }> {
  const client = await getPostgresClient();
  try {
    return await getAnalyticsEventsWithClient(client, botId, userId, params);
  } finally {
    client.release();
  }
}

export async function getAnalyticsStats(
  botId: string,
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<AnalyticsStats> {
  const client = await getPostgresClient();
  try {
    return await getAnalyticsStatsWithClient(client, botId, userId, dateFrom, dateTo);
  } finally {
    client.release();
  }
}

export async function getPopularPaths(
  botId: string,
  userId: number,
  limit: number,
  dateFrom?: string,
  dateTo?: string
): Promise<PopularPath[]> {
  const client = await getPostgresClient();
  try {
    return await getPopularPathsWithClient(client, botId, userId, limit, dateFrom, dateTo);
  } finally {
    client.release();
  }
}

export async function getFunnelData(
  botId: string,
  userId: number,
  stateKeys: string[],
  dateFrom?: string,
  dateTo?: string
): Promise<FunnelStep[]> {
  const client = await getPostgresClient();
  try {
    return await getFunnelDataWithClient(client, botId, userId, stateKeys, dateFrom, dateTo);
  } finally {
    client.release();
  }
}

export async function getTimeSeriesData(
  botId: string,
  userId: number,
  eventType: string,
  dateFrom?: string,
  dateTo?: string,
  granularity?: 'hour' | 'day' | 'week'
): Promise<TimeSeriesData[]> {
  const client = await getPostgresClient();
  try {
    return await getTimeSeriesDataWithClient(
      client,
      botId,
      userId,
      eventType,
      dateFrom,
      dateTo,
      granularity
    );
  } finally {
    client.release();
  }
}

export async function exportAnalyticsToCSV(
  botId: string,
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<string> {
  const client = await getPostgresClient();
  try {
    return await exportAnalyticsToCSVWithClient(client, botId, userId, dateFrom, dateTo);
  } finally {
    client.release();
  }
}
