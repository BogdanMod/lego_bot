import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function initPostgres(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  // Test connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('PostgreSQL connection error:', err);
    } else {
      console.log('✅ PostgreSQL connected successfully');
      console.log('Database time:', res.rows[0].now);
    }
  });

  return pool;
}

export async function getPostgresClient(): Promise<PoolClient> {
  console.log('🔌 getPostgresClient - pool exists:', !!pool);
  
  if (!pool) {
    console.log('📦 Initializing PostgreSQL pool...');
    initPostgres();
  }
  
  if (!pool) {
    console.error('❌ PostgreSQL pool is not initialized');
    throw new Error('PostgreSQL pool is not initialized');
  }

  try {
    console.log('🔗 Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ PostgreSQL client connected');
    return client;
  } catch (error) {
    console.error('❌ Error connecting to PostgreSQL:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}

export function closePostgres(): Promise<void> {
  if (pool) {
    return pool.end();
  }
  return Promise.resolve();
}

export function getPool(): Pool | null {
  return pool;
}

