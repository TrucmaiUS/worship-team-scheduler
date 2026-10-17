import { Pool } from 'pg';

declare global {
  var pgPool: Pool | undefined;
}

const pool =
  globalThis.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.pgPool = pool;
}

export default pool;
