import pool from './lib/db.js';

async function check() {
  const { rows } = await pool.query('SELECT r.*, u.full_name, s.date FROM registrations r JOIN users u ON r.user_id = u.id JOIN services s ON r.service_id = s.id ORDER BY s.date DESC');
  console.log('Total Registrations:', rows.length);
  console.log(rows.slice(0, 5));
  process.exit(0);
}
check();
