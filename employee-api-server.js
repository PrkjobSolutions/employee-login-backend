require('dotenv').config();
// server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    if (!origin) return cb(null, true); // allow non-browser clients
    if (FRONTENDS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Simple log to confirm requests arrive
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
app.get('/api/employees', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /api/employees error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new employee
app.post('/api/employees', async (req, res) => {
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
    console.error('POST /api/employees error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


/* -------------------------
   Extra API
   ------------------------- */

// Health check
app.get('/', (req, res) => res.send('OK'));


/* -------------------------
   Auth endpoints
   ------------------------- */

app.post("/admin-login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: admin, error } = await supabase
      .from("admin")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !admin) {
      return res.json({ success: false, message: "Invalid username or password" });
    }

    if (admin.password !== password) {
      return res.json({ success: false, message: "Invalid username or password" });
    }

    return res.json({ success: true, admin });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { employee_id, password } = req.body;

  try {
    const { data: employee, error } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", employee_id)
      .single();

    if (error || !employee) {
      return res.json({ success: false, message: "Employee not found" });
    }

    if ((employee.password || "").trim() !== (password || "").trim()) {
      return res.json({ success: false, message: "Incorrect password" });
    }


    return res.json({ success: true, employee });
  } catch (err) {
    console.error("Employee login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


/* -------------------------
   Employee Data API
   ------------------------- */

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
      .from("documents")
      .select("*")
      .eq("employee_id", id);

    if (error) throw error;
    res.json(docs);
  } catch (err) {
    console.error("GET /api/documents/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get leave summary for an employee (fixed)
app.get("/api/leaves/summary/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("leave_summary")
      .select("pl, cl, sl, el")
      .eq("employee_id", id)
      .single(); // force one row

    if (error && error.code === "PGRST116") {
      // No row found → return defaults
      return res.json({ pl: 0, cl: 0, sl: 0, el: 0 });
    }
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("GET /api/leaves/summary error:", err.message);
    res.status(500).json({ error: "Failed to fetch leave summary" });
  }
});


// Get leave events for an employee
app.get("/api/leave-events/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("leave_events")
      .select("employee_id, leave_type, start_date, end_date, color")
      .eq("employee_id", id);

    if (error) throw error;

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
   Events API
   ------------------------- */

// Get all events
app.get("/api/events", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("GET /api/events error:", err.message);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Add new event
app.post("/api/events", async (req, res) => {
  const { title, date, description, event_type } = req.body;  // ✅ include event_type
  try {
    const { data, error } = await supabase
      .from("events")
      .insert([{ title, date, description, event_type }])  // ✅ insert event_type too
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("POST /api/events error:", err.message);
    res.status(500).json({ error: "Failed to add event" });
  }
});


app.delete("/api/events/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/events/:id error:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete event" });
  }
});



app.put("/admin/password", async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  try {
    // Assuming single admin with id = 1
    const { data, error } = await supabase
      .from("admin")
      .update({ password: newPassword })
      .eq("id", 1)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /admin/password error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update password" });
  }
});





/* -------------------------
   Leave Events (Admin Calendar)
   ------------------------- */

// POST new leave event
app.post("/api/leave-events", async (req, res) => {
  const { employee_id, start_date, end_date, leave_type, color } = req.body;

  try {
    const { data: event, error } = await supabase
      .from("leave_events")
      .insert([{ employee_id, start_date, end_date, leave_type, color }])
      .select()
      .single();

    if (error) throw error;

    const col = leave_type.toLowerCase();
    if (["pl", "cl", "sl", "el"].includes(col)) {
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

// ✅ Update leave summary for an employee
app.put("/api/leaves/summary/:id", async (req, res) => {
  const { id } = req.params;
  const { pl, cl, sl, el } = req.body;

  try {
    const { data, error } = await supabase
      .from("leave_summary")
      .upsert([{ employee_id: id, pl, cl, sl, el }], { onConflict: ["employee_id"] })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("PUT /api/leaves/summary error:", err.message);
    res.status(500).json({ error: "Failed to update leave summary" });
  }
});


/* Start server */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
