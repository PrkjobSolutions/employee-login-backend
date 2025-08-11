// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db'); // pg wrapper that you already have
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');
const path = require('path');

// Serve public folder
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});
const upload = multer({ storage });




app.use(cors());
app.use(bodyParser.json());

// Serve static public folder (same as before)
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Helper: run query and return rows
 */
async function runQuery(q, params = []) {
  try {
    const res = await db.query(q, params);
    return res.rows;
  } catch (err) {
    throw err;
  }
}

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

// Upload endpoint
app.post('/api/upload-profile-image/:employee_id', upload.single('profileimage'), async (req, res) => {
  const { employee_id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  try {
    await db.query(
      'UPDATE employees SET profileimage = $1 WHERE employee_id = $2',
      [imageUrl, employee_id]
    );
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

