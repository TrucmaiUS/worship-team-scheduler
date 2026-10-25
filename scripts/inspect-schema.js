const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function getFullSchema() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  
  for (const row of tablesRes.rows) {
    const colsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [row.table_name]);
    
    console.log(`TABLE: ${row.table_name}`);
    colsRes.rows.forEach(c => {
      console.log(`  - ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`);
    });
    console.log('');
  }
  await pool.end();
}

getFullSchema();
