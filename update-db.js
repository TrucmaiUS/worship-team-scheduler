const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await pool.query('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS role_detail VARCHAR(255)');
    console.log("Added role_detail column");
  } catch(e) {
    console.log(e);
  }
  pool.end();
}
run();
