const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://postgres:xgLtrOqtYxWNQObsFCuybmVmkmhrqYeh@trolley.proxy.rlwy.net:35139/railway",
  ssl: {
    rejectUnauthorized: false, // Railway requires SSL
  },
});

client.connect()
  .then(() => {
    console.log("✅ Connected to Railway PostgreSQL successfully!");
    return client.query("SELECT NOW()"); // Simple test query
  })
  .then(res => {
    console.log("📅 Current time from DB:", res.rows[0]);
  })
  .catch(err => {
    console.error("❌ Connection error:", err);
  })
  .finally(() => client.end());
