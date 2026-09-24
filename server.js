const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');
const { db, dbQuery } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ashish_vegan_iot_secret_key_2026';

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Helper to format Date in Asia/Kolkata (+5:30)
function formatKolkataTime(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  
  // Format options for Asia/Kolkata
  const timeOptions = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  const dateOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };

  const timeStr = new Intl.DateTimeFormat('en-IN', timeOptions).format(d);
  const dateStr = new Intl.DateTimeFormat('en-IN', dateOptions).format(d);

  return { timeStr, dateStr };
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  const token = tokenFromHeader || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired session' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields (Name, Email, Password) are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    // Check if email already registered
    const existing = await dbQuery.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email is already registered. Please log in.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbQuery.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword]
    );

    const user = { id: result.lastID, name: name.trim(), email: email.toLowerCase().trim() };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and Password are required' });
    }

    const user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const tokenPayload = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: tokenPayload,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
});

// Current User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});


// ==========================================
// 2. SENSOR DATA ROUTES (DHT11)
// ==========================================

// Ingestion via POST (Used by ESP8266 or Simulator)
app.post('/api/sensor-data', async (req, res) => {
  try {
    const temp = parseFloat(req.body.temperature !== undefined ? req.body.temperature : req.body.temp);
    const hum = parseFloat(req.body.humidity !== undefined ? req.body.humidity : req.body.hum);

    if (isNaN(temp) || isNaN(hum)) {
      return res.status(400).json({ success: false, message: 'Valid temperature and humidity values are required' });
    }

    const nowIso = new Date().toISOString();
    const result = await dbQuery.run(
      'INSERT INTO sensor_readings (temperature, humidity, created_at) VALUES (?, ?, ?)',
      [temp, hum, nowIso]
    );

    const { timeStr, dateStr } = formatKolkataTime(nowIso);

    res.status(201).json({
      success: true,
      message: 'Sensor data recorded',
      data: {
        id: result.lastID,
        temperature: temp,
        humidity: hum,
        created_at: nowIso,
        time: timeStr,
        date: dateStr
      }
    });
  } catch (err) {
    console.error('Sensor post error:', err);
    res.status(500).json({ success: false, message: 'Failed to record sensor data' });
  }
});

// Ingestion via GET (Convenient for low-overhead microcontroller calls: /api/sensor-data/update?temp=28.4&humidity=62)
app.get('/api/sensor-data/update', async (req, res) => {
  try {
    const temp = parseFloat(req.query.temp || req.query.temperature);
    const hum = parseFloat(req.query.humidity || req.query.hum);

    if (isNaN(temp) || isNaN(hum)) {
      return res.status(400).send('ERROR: Invalid temp or humidity');
    }

    const nowIso = new Date().toISOString();
    await dbQuery.run(
      'INSERT INTO sensor_readings (temperature, humidity, created_at) VALUES (?, ?, ?)',
      [temp, hum, nowIso]
    );

    res.send(`OK: Saved Temp=${temp}C, Hum=${hum}%`);
  } catch (err) {
    console.error('Sensor GET update error:', err);
    res.status(500).send('ERROR: Database error');
  }
});

// Latest sensor reading
app.get('/api/sensor-data/latest', async (req, res) => {
  try {
    const latest = await dbQuery.get('SELECT * FROM sensor_readings ORDER BY created_at DESC, id DESC LIMIT 1');
    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: 'No sensor data recorded yet'
      });
    }

    const { timeStr, dateStr } = formatKolkataTime(latest.created_at);

    res.json({
      success: true,
      data: {
        id: latest.id,
        temperature: Number(latest.temperature.toFixed(1)),
        humidity: Number(latest.humidity.toFixed(1)),
        created_at: latest.created_at,
        time: timeStr,
        date: dateStr
      }
    });
  } catch (err) {
    console.error('Sensor latest error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch latest sensor data' });
  }
});

// Historical Paginated Records (20 at a time, latest first)
app.get('/api/sensor-data/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countRow = await dbQuery.get('SELECT COUNT(*) as total FROM sensor_readings');
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const rows = await dbQuery.all(
      'SELECT * FROM sensor_readings ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const records = rows.map((r, index) => {
      const { timeStr, dateStr } = formatKolkataTime(r.created_at);
      return {
        seq: total - (offset + index), // Natural serial count
        id: r.id,
        temperature: Number(r.temperature.toFixed(1)),
        humidity: Number(r.humidity.toFixed(1)),
        created_at: r.created_at,
        time: timeStr,
        date: dateStr
      };
    });

    res.json({
      success: true,
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (err) {
    console.error('Sensor history error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sensor records' });
  }
});

// Delete specific sensor record
app.delete('/api/sensor-data/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid record ID' });
    }

    const result = await dbQuery.run('DELETE FROM sensor_readings WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, message: `Record #${id} deleted successfully` });
  } catch (err) {
    console.error('Delete sensor record error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete record' });
  }
});

// Chart Data (latest 30 readings for trend graphs)
app.get('/api/sensor-data/chart', async (req, res) => {
  try {
    const rows = await dbQuery.all(
      'SELECT * FROM (SELECT * FROM sensor_readings ORDER BY created_at DESC, id DESC LIMIT 30) ORDER BY created_at ASC, id ASC'
    );

    const labels = [];
    const temperatures = [];
    const humidities = [];

    rows.forEach(r => {
      const { timeStr } = formatKolkataTime(r.created_at);
      labels.push(timeStr);
      temperatures.push(Number(r.temperature.toFixed(1)));
      humidities.push(Number(r.humidity.toFixed(1)));
    });

    res.json({
      success: true,
      data: {
        labels,
        temperatures,
        humidities
      }
    });
  } catch (err) {
    console.error('Chart data error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
});

// Simulate sensor data for testing without hardware
app.post('/api/sensor-data/simulate', async (req, res) => {
  try {
    // Generate realistic fluctuating temperature & humidity
    const randomTemp = (25 + Math.random() * 8).toFixed(1); // 25.0 - 33.0 °C
    const randomHum = (50 + Math.random() * 25).toFixed(1); // 50.0 - 75.0 %

    const nowIso = new Date().toISOString();
    const result = await dbQuery.run(
      'INSERT INTO sensor_readings (temperature, humidity, created_at) VALUES (?, ?, ?)',
      [parseFloat(randomTemp), parseFloat(randomHum), nowIso]
    );

    const { timeStr, dateStr } = formatKolkataTime(nowIso);

    res.json({
      success: true,
      message: 'Simulated sensor reading added',
      data: {
        id: result.lastID,
        temperature: parseFloat(randomTemp),
        humidity: parseFloat(randomHum),
        created_at: nowIso,
        time: timeStr,
        date: dateStr
      }
    });
  } catch (err) {
    console.error('Simulate error:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate sensor data' });
  }
});


// ==========================================
// 3. SMART LCD 16x2 ROUTES
// ==========================================

// Get Current LCD Text (JSON format)
app.get('/api/lcd', async (req, res) => {
  try {
    const row = await dbQuery.get('SELECT row1, row2, updated_at FROM lcd_settings WHERE id = 1');
    const { timeStr, dateStr } = formatKolkataTime(row ? row.updated_at : new Date());

    res.json({
      success: true,
      row1: row ? row.row1 : 'AshishVegan',
      row2: row ? row.row2 : 'System Ready',
      updated_at: row ? row.updated_at : null,
      updated_time: `${dateStr} ${timeStr}`
    });
  } catch (err) {
    console.error('LCD get error:', err);
    res.status(500).json({ success: false, message: 'Failed to get LCD settings' });
  }
});

// Plain text LCD endpoint for ESP8266 simple parsing
// Returns row1 followed by newline and row2
app.get('/api/lcd/raw', async (req, res) => {
  try {
    const row = await dbQuery.get('SELECT row1, row2 FROM lcd_settings WHERE id = 1');
    const row1 = (row ? row.row1 : 'AshishVegan').padEnd(16).substring(0, 16);
    const row2 = (row ? row.row2 : 'System Ready').padEnd(16).substring(0, 16);
    res.type('text/plain').send(`${row1}\n${row2}`);
  } catch (err) {
    res.status(500).send("AshishVegan     \nSystem Error    ");
  }
});

// Update LCD Text
app.post('/api/lcd', async (req, res) => {
  try {
    let { row1, row2 } = req.body;
    row1 = (row1 !== undefined ? String(row1) : '').trim().substring(0, 16);
    row2 = (row2 !== undefined ? String(row2) : '').trim().substring(0, 16);

    const nowIso = new Date().toISOString();
    await dbQuery.run(
      'UPDATE lcd_settings SET row1 = ?, row2 = ?, updated_at = ? WHERE id = 1',
      [row1, row2, nowIso]
    );

    const { timeStr, dateStr } = formatKolkataTime(nowIso);

    res.json({
      success: true,
      message: 'LCD content updated successfully',
      row1,
      row2,
      updated_at: nowIso,
      updated_time: `${dateStr} ${timeStr}`
    });
  } catch (err) {
    console.error('LCD post error:', err);
    res.status(500).json({ success: false, message: 'Failed to update LCD content' });
  }
});


// ==========================================
// 4. LED AUTOMATION ROUTES
// ==========================================

// Get current LED status
app.get('/api/led', async (req, res) => {
  try {
    const row = await dbQuery.get('SELECT state, updated_at FROM led_state WHERE id = 1');
    const state = row ? row.state : 0;
    const { timeStr, dateStr } = formatKolkataTime(row ? row.updated_at : new Date());

    res.json({
      success: true,
      state: state,
      status: state === 1 ? 'ON' : 'OFF',
      updated_at: row ? row.updated_at : null,
      updated_time: `${dateStr} ${timeStr}`
    });
  } catch (err) {
    console.error('LED get error:', err);
    res.status(500).json({ success: false, message: 'Failed to get LED state' });
  }
});

// Simple endpoint returning "1" or "0" for fast ESP8266 microcontroller parsing
app.get('/api/led/status', async (req, res) => {
  try {
    const row = await dbQuery.get('SELECT state FROM led_state WHERE id = 1');
    res.type('text/plain').send(row && row.state === 1 ? '1' : '0');
  } catch (err) {
    res.status(500).send('0');
  }
});

// Toggle LED state (ON <-> OFF)
app.post('/api/led/toggle', async (req, res) => {
  try {
    const current = await dbQuery.get('SELECT state FROM led_state WHERE id = 1');
    const newState = current && current.state === 1 ? 0 : 1;
    const nowIso = new Date().toISOString();

    await dbQuery.run('UPDATE led_state SET state = ?, updated_at = ? WHERE id = 1', [newState, nowIso]);

    const { timeStr, dateStr } = formatKolkataTime(nowIso);

    res.json({
      success: true,
      message: `LED switched ${newState === 1 ? 'ON' : 'OFF'}`,
      state: newState,
      status: newState === 1 ? 'ON' : 'OFF',
      updated_at: nowIso,
      updated_time: `${dateStr} ${timeStr}`
    });
  } catch (err) {
    console.error('LED toggle error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle LED state' });
  }
});

// Set LED explicit state
app.post('/api/led', async (req, res) => {
  try {
    const state = (req.body.state === 1 || req.body.state === '1' || req.body.state === true || req.body.state === 'ON') ? 1 : 0;
    const nowIso = new Date().toISOString();

    await dbQuery.run('UPDATE led_state SET state = ?, updated_at = ? WHERE id = 1', [state, nowIso]);

    const { timeStr, dateStr } = formatKolkataTime(nowIso);

    res.json({
      success: true,
      message: `LED set to ${state === 1 ? 'ON' : 'OFF'}`,
      state: state,
      status: state === 1 ? 'ON' : 'OFF',
      updated_at: nowIso,
      updated_time: `${dateStr} ${timeStr}`
    });
  } catch (err) {
    console.error('LED set error:', err);
    res.status(500).json({ success: false, message: 'Failed to set LED state' });
  }
});


// System Health / Ping endpoint
app.get('/api/health', (req, res) => {
  const { timeStr, dateStr } = formatKolkataTime();
  res.json({
    status: 'online',
    app: 'AshishVegan IoT Cloud Platform',
    kolkata_time: `${dateStr} ${timeStr}`,
    uptime_seconds: Math.floor(process.uptime())
  });
});

// Fallback route for SPA / Client routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to get local network IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('====================================================');
  console.log(`🌿 AshishVegan IoT Server is Running!`);
  console.log(`📍 Local URL:     http://localhost:${PORT}`);
  console.log(`🌐 Network URL:   http://${localIp}:${PORT}`);
  console.log(`⚡ Render Ready:  Binds to 0.0.0.0, PORT=${PORT}`);
  console.log(`🕒 Timezone:      +5:30 Asia/Kolkata`);
  console.log('====================================================');
});
