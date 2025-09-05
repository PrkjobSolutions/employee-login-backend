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

app.post("/login", async (req, res) => {
  const { employee_id, password } = req.body;

  try {
    // Fetch employee from Supabase
    const { data: employee, error } = await supabase
      .from("employees")       // your table name
      .select("*")
      .eq("employee_id", employee_id)
      .single();               // get only one row

    if (error || !employee) {
      return res.json({ success: false, message: "Employee not found" });
    }

    // Check password
    if (employee.password !== password) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    // Success
    return res.json({ success: true, employee });
  } catch (err) {
    console.error("Employee login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// GET employee by employee_id
app.get("/api/employee/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: employee, error } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", id)
      .single();

    if (error || !employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("GET /api/employee/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET documents for employee
app.get("/api/documents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: docs, error } = await supabase
      .from("documents") // 👈 make sure you have this table
      .select("*")
      .eq("employee_id", id);

    if (error) throw error;
    res.json(docs);
  } catch (err) {
    console.error("GET /api/documents/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get leave summary for an employee
app.get("/api/leaves/summary/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("leave_summary")
      .select("employee_id, pl, cl, sl, el")
      .eq("employee_id", id)
      .maybeSingle();   // 👈 prevents crash if no row

    if (error) throw error;

    if (!data) {
      // 👇 default values if row doesn’t exist
      return res.json({ employee_id: id, pl: 0, cl: 0, sl: 0, el: 0 });
    }

    res.json(data);
  } catch (err) {
    console.error("Error fetching leave summary:", err.message);
    res.status(500).json({ error: "Failed to fetch leave summary" });
  }
});



// GET leave summary for employee

/* -------------------------
   Leave Events (Admin Calendar)
   ------------------------- */


// POST new leave event
app.post("/api/leave-events", async (req, res) => {
  const { employee_id, date, leave_type, color } = req.body;

  try {
    // 1. Insert into leave_events
    const { data: event, error } = await supabase
      .from("leave_events")
      .insert([{ employee_id, date, leave_type, color }])
      .select()
      .single();

    if (error) throw error;

    // 2. Update leave summary counts
    const col = leave_type.toLowerCase(); // e.g., "PL" → "pl"
    if (["pl", "cl", "sl", "el"].includes(col)) {
      // increment the right counter
      await supabase.rpc("increment_leave_count", {
        emp_id: employee_id,
        leave_col: col
      });
    }

    res.status(201).json(event);
  } catch (err) {
    console.error("POST /api/leave-events error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

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

app.post("/login", async (req, res) => {
  const { employee_id, password } = req.body;

  try {
    // Fetch employee from Supabase
    const { data: employee, error } = await supabase
      .from("employees")       // your table name
      .select("*")
      .eq("employee_id", employee_id)
      .single();               // get only one row

    if (error || !employee) {
      return res.json({ success: false, message: "Employee not found" });
    }

    // Check password
    if (employee.password !== password) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    // Success
    return res.json({ success: true, employee });
  } catch (err) {
    console.error("Employee login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// GET employee by employee_id
app.get("/api/employee/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: employee, error } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", id)
      .single();

    if (error || !employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("GET /api/employee/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET documents for employee
app.get("/api/documents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: docs, error } = await supabase
      .from("documents") // 👈 make sure you have this table
      .select("*")
      .eq("employee_id", id);

    if (error) throw error;
    res.json(docs);
  } catch (err) {
    console.error("GET /api/documents/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get leave summary for an employee
app.get("/api/leaves/summary/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("leave_summary")
      .select("employee_id, pl, cl, sl, el")
      .eq("employee_id", id)
      .maybeSingle();   // 👈 prevents crash if no row

    if (error) throw error;

    if (!data) {
      // 👇 default values if row doesn’t exist
      return res.json({ employee_id: id, pl: 0, cl: 0, sl: 0, el: 0 });
    }

    res.json(data);
  } catch (err) {
    console.error("Error fetching leave summary:", err.message);
    res.status(500).json({ error: "Failed to fetch leave summary" });
  }
});


// ✅ Get leave events for an employee
app.get("/api/leave-events/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("leave_events")
      .select("employee_id, leave_type, start_date, end_date, color")
      .eq("employee_id", id);

    if (error) throw error;

    // Transform to FullCalendar format
    const events = data.map(ev => ({
      title: ev.leave_type,
      start: ev.start_date,
      end: ev.end_date,
      color: ev.color || "#f39c12"
    }));

    res.json(events);
  } catch (err) {
    console.error("GET /api/leave-events/:id error:", err.message);
    res.status(500).json({ error: "Failed to fetch leave events" });
  }
});


/* -------------------------
   Leave Events (Admin Calendar)
   ------------------------- */


// POST new leave event
app.post("/api/leave-events", async (req, res) => {
  const { employee_id, date, leave_type, color } = req.body;

  try {
    // 1. Insert into leave_events
    const { data: event, error } = await supabase
      .from("leave_events")
      .insert([{ employee_id, date, leave_type, color }])
      .select()
      .single();

    if (error) throw error;

    // 2. Update leave summary counts
    const col = leave_type.toLowerCase(); // e.g., "PL" → "pl"
    if (["pl", "cl", "sl", "el"].includes(col)) {
      // increment the right counter
      await supabase.rpc("increment_leave_count", {
        emp_id: employee_id,
        leave_col: col
      });
    }

    res.status(201).json(event);
  } catch (err) {
    console.error("POST /api/leave-events error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
