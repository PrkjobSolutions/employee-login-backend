require('dotenv').config();
// server.js


const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const multer = require('multer');

const { google } = require('googleapis');
const fs = require('fs');
// Google Drive Auth
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json', // downloaded from Google Cloud
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const driveService = google.drive({ version: 'v3', auth });


const app = express();
const PORT = process.env.PORT || 3000;

// CORS (allow your deployed frontend + local dev)
const FRONTENDS = [
  'https://employee-login-frontend.onrender.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const corsOptions = {
  origin: function (origin, cb) {
    // allow non-browser clients (curl/postman) or same-origin (no origin)
    if (!origin) return cb(null, true);
    if (FRONTENDS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400 // cache preflight for 24h
};

app.use(cors(corsOptions));
// handle preflight for all routes
app.options('*', cors(corsOptions));

// Simple log to confirm requests arrive (helps debug button clicks)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/documents')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.use(bodyParser.json());

/* -------------------------
   Cloudinary File Upload
   ------------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'employee_documents',
    allowed_formats: ['jpg', 'png', 'pdf', 'doc', 'docx'],
    resource_type: 'auto'   // 👈 important for mixed file types
  }
});

const upload = multer({ storage });

// Upload route
const upload = multer({ dest: 'tmp/' }); // store temporarily before upload to Drive

app.post('/api/documents/upload/:empId', upload.single('file'), async (req, res) => {
  try {
    const empId = req.params.empId;

    const fileMetadata = {
      name: req.file.originalname,
      parents: [process.env.GDRIVE_FOLDER_ID] // Google Drive folder ID
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path)
    };

    const driveResponse = await driveService.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, webViewLink, webContentLink'
    });

    // delete tmp file after upload
    fs.unlinkSync(req.file.path);

    // store in DB (employee_documents table)
    const fileUrl = driveResponse.data.webViewLink;
    await db.query(
      `INSERT INTO employee_documents (employee_id, offer_letter_url)
       VALUES ($1, $2)
       ON CONFLICT (employee_id) DO UPDATE
       SET offer_letter_url = EXCLUDED.offer_letter_url`,
      [empId, fileUrl]
    );

    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* -------------------------
   Employees endpoints
   ------------------------- */

// GET all employees
app.get('/employees', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM employees ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('GET /employees error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single employee by numeric id (primary key)
app.get('/employees/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const rows = await runQuery('SELECT * FROM employees WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new employee (admin panel uses POST /employees)
app.post('/employees', async (req, res) => {
  try {
    const {
      name,
      employee_id,
      designation,
      dob,
      joining_date,
      payroll_name,
      team,
      grade,
      profileImage,
      password
    } = req.body;

    const q = `
      INSERT INTO employees
      (employee_id, name, designation, dob, joining_date, payroll_name, team, grade, profileimage, password)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;
    const vals = [
      employee_id || null,
      name || null,
      designation || null,
      dob || null,
      joining_date || null,
      payroll_name || null,
      team || null,
      grade || null,
      profileImage || null,
      password || null
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /employees error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Update employee by numeric id
app.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      employee_id,
      designation,
      dob,
      joining_date,
      payroll_name,
      team,
      grade,
      profileImage,
      password
    } = req.body;

    const q = `
      UPDATE employees SET
        employee_id = $1,
        name = $2,
        designation = $3,
        dob = $4,
        joining_date = $5,
        payroll_name = $6,
        team = $7,
        grade = $8,
        profileimage = $9,
        password = $10
      WHERE id = $11
      RETURNING *;
    `;

    const vals = [
      employee_id || null,
      name || null,
      designation || null,
      dob || null,
      joining_date || null,
      payroll_name || null,
      team || null,
      grade || null,
      profileImage || null,
      password || null,
      id
    ];

    const { rows } = await db.query(q, vals);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /employees/:id error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// DELETE employee by numeric id
app.delete('/employees/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('DELETE FROM employees WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------
   Login endpoints
   ------------------------- */

// Employee login (employee_id + password)
app.post('/login', async (req, res) => {
  const { employee_id, password } = req.body;
  try {
    const { rows } = await db.query(
      'SELECT * FROM employees WHERE employee_id = $1 AND password = $2 LIMIT 1',
      [employee_id, password]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid ID or Password' });
    res.json({ success: true, employee: rows[0] });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin login
app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM admin WHERE username = $1 AND password = $2 LIMIT 1', [username, password]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    res.json({ success: true, message: 'Admin login successful' });
  } catch (err) {
    console.error('Admin Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update admin password (hardcoded username as before)
app.put('/admin/password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const username = 'aayushi'; // keep same as your app expects

    const { rowCount } = await db.query('UPDATE admin SET password = $1 WHERE username = $2', [newPassword, username]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Admin user not found' });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ success: false, error: 'Password update failed' });
  }
});

/* -------------------------
   Extra API
   ------------------------- */

// Get employee by employee_id (string) — your previous route /api/employee/:emp_id
app.get('/api/employee/:emp_id', async (req, res) => {
  const emp_id = req.params.emp_id;
  try {
    const { rows } = await db.query('SELECT * FROM employees WHERE employee_id = $1 LIMIT 1', [emp_id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('/api/employee/:emp_id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* Health check */
app.get('/', (req, res) => res.send('OK'));

/* Leave Events Routes */

// Save a new leave event
app.post('/leave-events', async (req, res) => {
  const { employee_id, date, leave_type, color } = req.body;  // change 'start' → 'date'
  try {
    const result = await db.query(
      `INSERT INTO leave_events (employee_id, date, leave_type, color)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [employee_id, date, leave_type, color]  // also change 'start' → 'date'
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('POST /leave-events error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all leave events for a specific employee
app.get('/leave-events/:employee_id', async (req, res) => {
  const { employee_id } = req.params;
  try {
    const rows = await db.query(
      `SELECT id, employee_id, date AS start, leave_type AS title, color 
       FROM leave_events 
       WHERE employee_id = $1
       ORDER BY date`,
      [employee_id]
    );
    res.json(rows.rows); // rows.rows because pg returns { rows: [...] }
  } catch (err) {
    console.error('GET /leave-events/:employee_id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* -------------------------
   Events endpoints
   ------------------------- */

// Get all events
app.get('/events', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM events ORDER BY date');
    res.json(rows);
  } catch (err) {
    console.error('GET /events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new event
app.post('/events', async (req, res) => {
  try {
    const { title, date, description, event_type } = req.body;

    const q = `
      INSERT INTO events (title, date, description, event_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const vals = [title, date, description || "", event_type];
    const { rows } = await db.query(q, vals);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /events error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Delete event by id
app.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /events/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------
   Documents endpoints
   ------------------------- */

// Save/Update both document URLs for an employee (matches your Admin UI)
app.post('/api/documents/:empId', async (req, res) => {
  const { empId } = req.params;
  const { offerLetter, salarySlip } = req.body; // from your Admin saveDocuments()

  try {
    const q = `
      INSERT INTO employee_documents (employee_id, offer_letter_url, salary_slip_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        offer_letter_url = COALESCE(EXCLUDED.offer_letter_url, employee_documents.offer_letter_url),
        salary_slip_url  = COALESCE(EXCLUDED.salary_slip_url,  employee_documents.salary_slip_url),
        updated_at = NOW()
      RETURNING *;
    `;
    const vals = [empId, offerLetter || null, salarySlip || null];
    const { rows } = await db.query(q, vals);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('POST /api/documents/:empId error:', err);
    res.status(500).json({ success: false, error: 'Server error', details: err.message });
  }
});

// Get documents for an employee (matches your Employee UI: doc_type + file_path)
app.get('/api/documents/:empId', async (req, res) => {
  const { empId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT offer_letter_url, salary_slip_url
       FROM employee_documents
       WHERE employee_id = $1
       LIMIT 1;`,
      [empId]
    );

    if (!rows.length) return res.json([]); // no docs yet

    const row = rows[0];
    const out = [];
    if (row.offer_letter_url) out.push({ doc_type: 'offerLetter', file_path: row.offer_letter_url });
    if (row.salary_slip_url) out.push({ doc_type: 'salarySlip',  file_path: row.salary_slip_url  });

    res.json(out);
  } catch (err) {
    console.error('GET /api/documents/:empId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


