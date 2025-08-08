const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:xgLtrOqtYxWNQObsFCuybmVmkmhrqYeh@trolley.proxy.rlwy.net:35139/railway",
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  }
};
