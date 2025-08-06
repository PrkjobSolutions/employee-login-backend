const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('employees.db');

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
