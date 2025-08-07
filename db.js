const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ✅ This ensures the DB is always loaded from the same directory as db.js
const dbPath = path.join(__dirname, 'employees.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Could not connect to employees.db:', err.message);
  } else {
    console.log('✅ Connected to employees.db');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employee_id TEXT,
      designation TEXT,
      dob TEXT,
      joining_date TEXT,
      payroll_name TEXT,
      team TEXT,
      grade TEXT,
      profileImage TEXT,
      password TEXT,
      pl INTEGER DEFAULT 0,
      cl INTEGER DEFAULT 0,
      sl INTEGER DEFAULT 0,
      el INTEGER DEFAULT 0
    );
  `);
});

module.exports = db;


