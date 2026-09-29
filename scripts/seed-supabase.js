const { Pool } = require('pg');
const { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format } = require('date-fns');

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Seeding initial users...');
    const users = [
      { id: 'u1', name: 'Admin User', email: 'admin@musicministry.local', role: 'ADMIN' },
      { id: 'u2', name: 'Mai', email: 'mai@musicministry.local', role: 'USER' },
      { id: 'u3', name: 'An', email: 'an@musicministry.local', role: 'USER' },
      { id: 'u4', name: 'Linh', email: 'linh@musicministry.local', role: 'USER' },
      { id: 'u5', name: 'Nam', email: 'nam@musicministry.local', role: 'USER' },
      { id: 'u6', name: 'Khoa', email: 'khoa@musicministry.local', role: 'USER' },
    ];

    for (const u of users) {
      await pool.query(
        'INSERT INTO users (id, full_name, email, password, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
        [u.id, u.name, u.email, 'password123', u.role]
      );
    }

    console.log('Generating recurring events...');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y <= currentYear + 5; y++) {
      for (let m = 0; m < 12; m++) {
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const days = eachDayOfInterval({ start: firstDay, end: lastDay });
        
        let firstTuesdayFound = false;
        let sundayCount = 0;

        for (const day of days) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayOfWeek = getDay(day);

          if (dayOfWeek === 2 && !firstTuesdayFound) {
            firstTuesdayFound = true;
            await pool.query(
              'INSERT INTO services (id, title, date, start_time, end_time, location, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              [`s_${dateStr}_prayer`, 'Prayer Night', dateStr, '18:00', '19:30', 'Chapel', 'Monthly Prayer Night']
            );
          }

          if (dayOfWeek === 0) {
            sundayCount++;
            if (sundayCount === 2) {
              await pool.query(
                'INSERT INTO services (id, title, date, start_time, end_time, location, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
                [`s_${dateStr}_combined`, 'Combined Service', dateStr, '09:00', '13:00', 'Main Hall', 'Combined Service for all congregations']
              );
            } else {
              await pool.query(
                'INSERT INTO services (id, title, date, start_time, end_time, location, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
                [`s_${dateStr}_intl`, 'International Service', dateStr, '09:00', '10:30', 'Main Hall', 'English Service']
              );
              await pool.query(
                'INSERT INTO services (id, title, date, start_time, end_time, location, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
                [`s_${dateStr}_vn`, 'Vietnamese Service', dateStr, '11:00', '12:30', 'Main Hall', 'Vietnamese Service']
              );
            }
          }
        }
      }
    }

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await pool.end();
  }
}

seed();
