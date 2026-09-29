const Database = require('better-sqlite3');
const path = require('path');
const { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, isFirstDayOfMonth, addMonths, setDate, addDays, getWeekOfMonth, startOfDay, getDayOfYear } = require('date-fns');

const dbPath = path.join(process.cwd(), 'music-ministry.db');
const db = new Database(dbPath);

console.log('Generating recurring events...');

const insertService = db.prepare(`
  INSERT INTO services (id, title, date, start_time, end_time, location, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Delete all existing services to avoid duplicates, but note this will cascade delete registrations if FOREIGN KEY ON DELETE CASCADE is set.
// The user might lose registrations! Let's only do this for demo purposes, or we can just ignore conflicts.
// Wait, to be safe, I won't delete existing services. I'll just skip inserting if one with the same date/time exists.
const checkService = db.prepare(`
  SELECT id FROM services WHERE date = ? AND start_time = ? AND title = ?
`);

function generateForMonth(year, monthIndex) { // monthIndex is 0-11
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  
  let firstTuesdayFound = false;
  let sundayCount = 0;

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = getDay(day); // 0 = Sunday, 2 = Tuesday

    // 1st Tuesday: Prayer Night
    if (dayOfWeek === 2 && !firstTuesdayFound) {
      firstTuesdayFound = true;
      const title = 'Prayer Night';
      const start = '18:00';
      if (!checkService.get(dateStr, start, title)) {
        insertService.run(`s_${dateStr}_prayer`, title, dateStr, start, '19:30', 'Chapel', 'Monthly Prayer Night');
      }
    }

    // Sundays
    if (dayOfWeek === 0) {
      sundayCount++;
      
      if (sundayCount === 2) {
        // 2nd Sunday: Combined Service
        const title = 'Combined Service';
        const start = '09:00';
        if (!checkService.get(dateStr, start, title)) {
          insertService.run(`s_${dateStr}_combined`, title, dateStr, start, '13:00', 'Main Hall', 'Combined Service for all congregations');
        }
      } else {
        // Other Sundays: VN Services
        const vnTitle = 'Vietnamese Service';
        const vnStart = '11:00';
        if (!checkService.get(dateStr, vnStart, vnTitle)) {
          insertService.run(`s_${dateStr}_vn`, vnTitle, dateStr, vnStart, '12:30', 'Main Hall', 'Vietnamese Service');
        }
      }
    }
  }
}

// Generate for current year up to next 5 years
const currentYear = new Date().getFullYear();
for (let y = currentYear; y <= currentYear + 5; y++) {
  for (let m = 0; m < 12; m++) {
    generateForMonth(y, m);
  }
}

console.log('Events generation complete!');
