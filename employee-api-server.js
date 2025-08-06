// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path'); // ✅ add this
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Serve public folder
app.use(express.static(path.join(__dirname, 'public')));


// ✅ Get all employees
app.get('/employees', (req, res) => { 
  db.all("SELECT * FROM employees", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ✅ Add a new employee
app.post('/employees', (req, res) => {
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

  const query = `
    INSERT INTO employees (
      name, employee_id, designation, dob, joining_date,
      payroll_name, team, grade, profileImage, password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [name, employee_id, designation, dob, joining_date, payroll_name, team, grade, profileImage, password],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});



// ✅ Update an employee
app.put('/employees/:id', (req, res) => {
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

  const query = `
    UPDATE employees SET
      name = ?, employee_id = ?, designation = ?, dob = ?, joining_date = ?,
      payroll_name = ?, team = ?, grade = ?, profileImage = ?, password = ?
    WHERE id = ?
  `;

  const values = [
    name, employee_id, designation, dob, joining_date,
    payroll_name, team, grade, profileImage, password,
    req.params.id
  ];

  db.run(query, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// ✅ Login route for employees
app.post('/login', (req, res) => {
  const { employee_id, password } = req.body;

  const query = "SELECT * FROM employees WHERE employee_id = ? AND password = ?";
  db.get(query, [employee_id, password], (err, row) => {
    if (err) {
      console.error("Login error:", err); // optional: for debugging
      return res.status(500).json({ error: "Server error" });
    }

    if (!row) {
      return res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }

    res.json({ success: true, employee: row });
  });
});




// ✅ Admin Login route
app.post('/admin-login', (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM admin WHERE username = ? AND password = ?";
  db.get(query, [username, password], (err, row) => {
    if (err) {
      console.error("Admin Login error:", err);
      return res.status(500).json({ error: "Server error" });
    }

    if (!row) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.json({ success: true, message: "Admin login successful" });
  });
});


// ✅ Update admin password
app.put('/admin/password', (req, res) => {
  const { newPassword } = req.body;

  const username = 'aayushi'; // hardcoded for now

  const query = `UPDATE admin SET password = ? WHERE username = ?`;
  db.run(query, [newPassword, username], function (err) {
    if (err) {
      console.error("Password update error:", err.message);
      return res.status(500).json({ success: false, error: "Password update failed" });
    }

    res.json({ success: true, message: "Password updated successfully" });
  });
});


// ✅ Serve frontend files or fallback to login.html
app.get("*", (req, res) => {
  const requestedPath = path.join(__dirname, "public", req.path);
  res.sendFile(requestedPath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, "public", "login.html"));
    }
  });
});



// ✅ Start the server!
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});

app.get("/api/employee/:emp_id", (req, res) => {
  const emp_id = req.params.emp_id;

  db.get("SELECT * FROM employees WHERE employee_id = ?", [emp_id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    res.json(employee);
  });
});
