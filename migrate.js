// migrate.js
const db = require('./db');

async function migrate() {
  try {
    // Employees table
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

    // Admin table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ✅ Employee PDFs table (for storing uploaded PDF files)
    await db.query(`
      CREATE TABLE IF NOT EXISTS employee_pdfs (
        id SERIAL PRIMARY KEY,
        employee_id INT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/pdf',
        file_size BIGINT NOT NULL,
        file_data BYTEA NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Leave Events table
    await db.query(`
      CREATE TABLE IF NOT EXISTS leave_events (
        id SERIAL PRIMARY KEY,
        employee_id TEXT NOT NULL,
        date DATE NOT NULL,
        leave_type TEXT NOT NULL,
        color TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Employee Documents table (URLs)
    await db.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id SERIAL PRIMARY KEY,
        employee_id TEXT NOT NULL UNIQUE REFERENCES employees(employee_id) ON DELETE CASCADE,
        offer_letter_url TEXT,
        salary_slip_url TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Migration complete');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration error:', err
