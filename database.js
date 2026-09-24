const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'iot.db');

let db = null;
let saveTimeout = null;

// Synchronous save of SQLite binary buffer to disk
function saveToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

// Queue save (debounced for rapid writes)
function triggerSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveToDisk, 50);
}

// Flush changes on process exit
process.on('exit', () => saveToDisk());
process.on('SIGINT', () => { saveToDisk(); process.exit(0); });
process.on('SIGTERM', () => { saveToDisk(); process.exit(0); });

// Initialize WebAssembly SQLite database
const initPromise = initSqlJs().then(SQL => {
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('Connected to existing SQLite database at:', dbPath);
    } catch (e) {
      console.warn('Could not read existing database, creating fresh one:', e.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('Initialized new SQLite database at:', dbPath);
  }

  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_created_at ON sensor_readings(created_at DESC);

    CREATE TABLE IF NOT EXISTS lcd_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      row1 TEXT NOT NULL DEFAULT 'AshishVegan',
      row2 TEXT NOT NULL DEFAULT 'Welcome! IoT GCEOY',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO lcd_settings (id, row1, row2, updated_at)
    VALUES (1, 'AshishVegan IoT', 'Ready - GCEOY', CURRENT_TIMESTAMP);

    CREATE TABLE IF NOT EXISTS led_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO led_state (id, state, updated_at)
    VALUES (1, 0, CURRENT_TIMESTAMP);
  `);

  saveToDisk();
  return db;
}).catch(err => {
  console.error('Failed to initialize WebAssembly SQLite:', err);
});

// Helper functions for Promise-based queries (identical API interface)
const dbQuery = {
  get: async (sql, params = []) => {
    await initPromise;
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    } catch (err) {
      console.error('dbQuery.get error:', err.message, 'SQL:', sql);
      throw err;
    }
  },

  all: async (sql, params = []) => {
    await initPromise;
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('dbQuery.all error:', err.message, 'SQL:', sql);
      throw err;
    }
  },

  run: async (sql, params = []) => {
    await initPromise;
    try {
      db.run(sql, params);
      
      const lastRow = db.exec("SELECT last_insert_rowid() as lastID, changes() as changes");
      let lastID = 0;
      let changes = 0;
      if (lastRow && lastRow[0] && lastRow[0].values && lastRow[0].values[0]) {
        lastID = lastRow[0].values[0][0];
        changes = lastRow[0].values[0][1];
      }
      triggerSave();
      return { lastID, changes };
    } catch (err) {
      console.error('dbQuery.run error:', err.message, 'SQL:', sql);
      throw err;
    }
  }
};

module.exports = {
  db,
  dbQuery
};
