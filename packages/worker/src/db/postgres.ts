import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPostgresClient(): Promise<pg.PoolClient> {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
    });
  }
  return pool.connect();
}


