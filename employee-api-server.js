// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db'); // pg wrapper that you already have
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');

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
app.post('/employees', upload.single('profileimage'), async (req, res) => {
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
      password
    } = req.body;

    let profileImage = null;
    if (req.file) {
      profileImage = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

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
      profileImage,
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
app.put('/employees/:id', upload.single('profileimage'), async (req, res) => {
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
      password
    } = req.body;

    let profileImage = null;
    if (req.file) {
      profileImage = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    // get existing profileimage to keep if no new file
    const existing = await db.query('SELECT profileimage FROM employees WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });

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
      profileImage || existing.rows[0].profileimage,
      password || null,
      id
    ];

    const { rows } = await db.query(q, vals);
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
app.post('/employees', upload.single('profileimage'), async (req, res) => {
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
      password
    } = req.body;

    let profileImage = null;
    if (req.file) {
      profileImage = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

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
      profileImage,
      password || null
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /employees error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Update admin password (hardcoded username as before)
app.put('/employees/:id', upload.single('profileimage'), async (req, res) => {
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
      password
    } = req.body;

    let profileImage = null;
    if (req.file) {
      profileImage = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    // First, get existing employee to keep current profileImage if no new image uploaded
    const existing = await db.query('SELECT profileimage FROM employees WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });

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
      profileImage || existing.rows[0].profileimage, // keep old image if none uploaded
      password || null,
      id
    ];

    const { rows } = await db.query(q, vals);
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /employees/:id error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
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
