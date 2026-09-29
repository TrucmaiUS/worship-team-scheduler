const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'music-ministry.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Initializing database schema...');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    google_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'USER',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    team TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(service_id, user_id)
  );
`);

// Check if admin exists
const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
const admin = stmt.get('admin@musicministry.local');

if (!admin) {
  console.log('Seeding initial data...');
  
  const insertUser = db.prepare(`
    INSERT INTO users (id, full_name, email, password, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  const users = [
    { id: 'u1', name: 'Admin User', email: 'admin@musicministry.local', role: 'ADMIN' },
    { id: 'u2', name: 'Mai', email: 'mai@musicministry.local', role: 'USER' },
    { id: 'u3', name: 'An', email: 'an@musicministry.local', role: 'USER' },
    { id: 'u4', name: 'Linh', email: 'linh@musicministry.local', role: 'USER' },
    { id: 'u5', name: 'Nam', email: 'nam@musicministry.local', role: 'USER' },
    { id: 'u6', name: 'Khoa', email: 'khoa@musicministry.local', role: 'USER' },
  ];

  users.forEach(u => {
    insertUser.run(u.id, u.name, u.email, 'password123', u.role);
  });

  // Services are now generated dynamically using generate-events.js
}

console.log('Database seeded successfully.');
