import { Pool, PoolClient } from 'pg';
import { getPool, getPostgresClient } from './postgres';

export interface Bot {
  id: string;
  user_id: number;
  token: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBotData {
  user_id: number;
  token: string;
  name: string;
}

/**
 * Создать бота в базе данных
 */
export async function createBot(data: CreateBotData): Promise<Bot> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `INSERT INTO bots (user_id, token, name)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token, name, created_at, updated_at`,
      [data.user_id, data.token, data.name]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Получить всех ботов пользователя
 */
export async function getBotsByUserId(userId: number): Promise<Bot[]> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, created_at, updated_at
       FROM bots
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Получить бота по ID
 */
export async function getBotById(botId: string, userId: number): Promise<Bot | null> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, created_at, updated_at
       FROM bots
       WHERE id = $1 AND user_id = $2`,
      [botId, userId]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Проверить, существует ли бот с таким токеном
 */
export async function botExistsByToken(token: string): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `SELECT 1 FROM bots WHERE token = $1 LIMIT 1`,
      [token]
    );
    
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Удалить бота
 */
export async function deleteBot(botId: string, userId: number): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `DELETE FROM bots WHERE id = $1 AND user_id = $2`,
      [botId, userId]
    );
    
    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}

/**
 * Инициализация таблицы bots (создание таблицы если не существует)
 */
export async function initializeBotsTable(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized');
  }

  const fs = require('fs');
  const path = require('path');
  
  // Путь к миграции относительно текущего файла
  const migrationPath = path.join(__dirname, 'migrations', '001_create_bots_table.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  await pool.query(migrationSQL);
  console.log('✅ Bots table initialized');
}

