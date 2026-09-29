const { Pool } = require('pg');

async function removeInternationalService() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('Deleting International Services...');
    const result = await pool.query("DELETE FROM services WHERE title = 'International Service'");
    console.log(`Deleted ${result.rowCount} services. Registrations were auto-deleted due to CASCADE.`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

removeInternationalService();
