// migrate.js
const db = require('./db');

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_id TEXT UNIQUE,
        name TEXT,
        designation TEXT,
        dob DATE,
        joining_date DATE,
        payroll_name TEXT,
        team TEXT,
        grade TEXT,
        profileimage TEXT,
        password TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
