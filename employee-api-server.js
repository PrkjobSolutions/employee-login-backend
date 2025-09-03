require('dotenv').config();
// server.js


const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


const multer = require('multer');


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

// Upload route
const upload = multer({ dest: 'tmp/' }); // store temporarily before upload to Drive


/* -------------------------
   Employees endpoints
   ------------------------- */

// GET all employees
app.get('/employees', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /employees error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new employee
app.post('/employees', async (req, res) => {
  try {
    const {
      employee_id,
      name,
      designation,
      dob,
      joining_date,
      payroll_name,
      team,
      grade,
      password
    } = req.body;

    const { data, error } = await supabase
      .from('employees')
      .insert([{
        employee_id,
        name,
        designation,
        dob,
        joining_date,
        payroll_name,
        team,
        grade,
        password
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /employees error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


/* -------------------------
   Extra API
   ------------------------- */

/* Health check */
app.get('/', (req, res) => res.send('OK'));


// Create a new event
app.post('/events', async (req, res) => {
  try {
    const { title, date, description, event_type } = req.body;

   const { data, error } = await supabase
      .from('events')
      .insert([{ title, date, description: description || "", event_type }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);

  } catch (err) {
    console.error('POST /events error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.post("/admin-login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Fetch admin from Supabase
    const { data: admin, error } = await supabase
      .from("admin")       // your table name
      .select("*")
      .eq("username", username)
      .single();           // get a single row

    if (error || !admin) {
      return res.json({ success: false, message: "Invalid username or password" });
    }

    // Check password
    if (admin.password !== password) {
      return res.json({ success: false, message: "Invalid username or password" });
    }

    // Success
    return res.json({ success: true, admin });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


