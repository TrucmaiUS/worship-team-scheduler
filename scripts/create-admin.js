const { Pool } = require('pg');

async function updateAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Delete the old one
    await pool.query("DELETE FROM users WHERE email = 'admin@musicministry.local'");
    
    // Insert new one
    await pool.query(
      "INSERT INTO users (id, full_name, email, password, role) VALUES ('u_admin', 'System Admin', 'admin@musicministry.com', 'admin123', 'ADMIN') ON CONFLICT (email) DO NOTHING"
    );
    console.log('Admin user updated successfully to .com!');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

updateAdmin();
