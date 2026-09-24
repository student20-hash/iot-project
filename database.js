const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'iot.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Initialize database schema
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sensor readings table
  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on sensor_readings for fast sorting and pagination
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_sensor_created_at ON sensor_readings(created_at DESC)
  `);

  // LCD text storage (single row with id=1)
  db.run(`
    CREATE TABLE IF NOT EXISTS lcd_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      row1 TEXT NOT NULL DEFAULT 'AshishVegan',
      row2 TEXT NOT NULL DEFAULT 'Welcome! IoT GCEOY',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize LCD default row if not exists
  db.run(`
    INSERT OR IGNORE INTO lcd_settings (id, row1, row2, updated_at)
    VALUES (1, 'AshishVegan IoT', 'Ready - GCEOY', CURRENT_TIMESTAMP)
  `);

  // LED state storage (single row with id=1)
  db.run(`
    CREATE TABLE IF NOT EXISTS led_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize LED default row if not exists
  db.run(`
    INSERT OR IGNORE INTO led_state (id, state, updated_at)
    VALUES (1, 0, CURRENT_TIMESTAMP)
  `);
});

// Helper functions for Promise-based queries
const dbQuery = {
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

module.exports = {
  db,
  dbQuery
};
