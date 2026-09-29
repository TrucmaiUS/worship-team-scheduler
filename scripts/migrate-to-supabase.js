const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL!');

    const sql = `
      -- Drop existing tables if re-running
      DROP TABLE IF EXISTS registrations CASCADE;
      DROP TABLE IF EXISTS services CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      -- Create users table
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        google_id TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'USER',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create services table
      CREATE TABLE services (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create registrations table
      CREATE TABLE registrations (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(service_id, user_id)
      );

      -- Enable RLS
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE services ENABLE ROW LEVEL SECURITY;
      ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

      -- Create Policies
      CREATE POLICY "Cho phép tất cả thao tác trên users" ON users FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Cho phép tất cả thao tác trên services" ON services FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Cho phép tất cả thao tác trên registrations" ON registrations FOR ALL USING (true) WITH CHECK (true);
    `;

    await client.query(sql);
    console.log('Schema created successfully!');

  } catch (err) {
    console.error('Error creating schema:', err);
  } finally {
    await client.end();
  }
}

run();
