const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    const client = await pool.connect();
    console.log('Connected successfully!');

    const sqlPath = path.join(__dirname, 'migrations', '001_create_song_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration: 001_create_song_schema.sql ...');
    await client.query(sql);
    console.log('Migration 001 applied successfully!');

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('document_imports', 'songs', 'song_versions', 'song_sections', 'themes', 'song_themes')
      ORDER BY table_name;
    `);
    console.log('Verified created tables:', res.rows.map(r => r.table_name));

    client.release();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
