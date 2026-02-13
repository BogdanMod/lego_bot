export interface BotUser {
    id: string;
    bot_id: string;
    telegram_user_id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    phone_number: string | null;
    email: string | null;
    language_code: string | null;
    first_interaction_at: Date;
    last_interaction_at: Date;
    interaction_count: number;
    metadata: Record<string, unknown> | null;
}
export interface BotUserStats {
    total: number;
    newLast7Days: number;
    conversionRate: number;
}
export type BotUserUpsertData = {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    phone_number?: string | null;
    email?: string | null;
    language_code?: string | null;
    metadata?: Record<string, unknown> | null;
};
export type CursorPaginationParams = {
    limit: number;
    cursor?: string;
};
export type PaginatedBotUsers = {
    users: BotUser[];
    nextCursor: string | null;
    hasMore: boolean;
};
type QueryResult<Row> = {
    rows: Row[];
};
export type DbClient = {
    query: <Row = any>(text: string, params?: any[]) => Promise<QueryResult<Row>>;
};
export declare function createOrUpdateBotUserWithClient(client: DbClient, botId: string, telegramUserId: string, data: BotUserUpsertData): Promise<BotUser>;
export declare function getBotUsersWithClient(client: DbClient, botId: string, userId: number, params: CursorPaginationParams): Promise<PaginatedBotUsers>;
export declare function getBotUserStatsWithClient(client: DbClient, botId: string, userId: number): Promise<BotUserStats>;
export declare function exportBotUsersToCSVWithClient(client: DbClient, botId: string, userId: number): Promise<string>;
export {};
//# sourceMappingURL=bot-users.d.ts.map