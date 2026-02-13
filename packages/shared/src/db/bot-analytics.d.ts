import type { DbClient } from './bot-users.js';
import type { AnalyticsEvent, AnalyticsStats, PopularPath, FunnelStep, TimeSeriesData, AnalyticsEventsParams, AnalyticsEventData } from '../types/analytics.js';
export type { AnalyticsEvent, AnalyticsStats, PopularPath, FunnelStep, TimeSeriesData, AnalyticsEventsParams, AnalyticsEventData, } from '../types/analytics.js';
export declare function logAnalyticsEventWithClient(client: DbClient, botId: string, telegramUserId: string | number, sourceUpdateId: string | number, eventType: string, data?: AnalyticsEventData): Promise<void>;
export declare function getAnalyticsEventsWithClient(client: DbClient, botId: string, userId: number, params: AnalyticsEventsParams): Promise<{
    events: AnalyticsEvent[];
    nextCursor: string | null;
    hasMore: boolean;
}>;
export declare function getAnalyticsStatsWithClient(client: DbClient, botId: string, userId: number, dateFrom?: string, dateTo?: string): Promise<AnalyticsStats>;
export declare function getPopularPathsWithClient(client: DbClient, botId: string, userId: number, limit: number, dateFrom?: string, dateTo?: string): Promise<PopularPath[]>;
export declare function getFunnelDataWithClient(client: DbClient, botId: string, userId: number, stateKeys: string[], dateFrom?: string, dateTo?: string): Promise<FunnelStep[]>;
export declare function getTimeSeriesDataWithClient(client: DbClient, botId: string, userId: number, eventType: string, dateFrom?: string, dateTo?: string, granularity?: 'hour' | 'day' | 'week'): Promise<TimeSeriesData[]>;
export declare function exportAnalyticsToCSVWithClient(client: DbClient, botId: string, userId: number, dateFrom?: string, dateTo?: string): Promise<string>;
//# sourceMappingURL=bot-analytics.d.ts.map