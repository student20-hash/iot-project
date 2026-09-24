# 🌿 AshishVegan IoT Smart Environmental Monitoring & Automation Platform

Designed and Developed by **Sayali Randive**, Dept. of Electrical Engineering, **GCEOY**.

---

## 📋 Overview

**AshishVegan** is an enterprise-grade IoT environmental telemetry and automation system. It bridges physical microcontrollers (**ESP8266**, **DHT11**, **16x2 I2C LCD**, and **LED**) with a modern web application designed with a sleek **Green Theme**, **Tailwind CSS**, **Node.js**, and an **SQLite** database.

The application is completely configured and **Render Deployable** out-of-the-box.

---

## ⚡ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, Tailwind CSS, Vanilla JS, FontAwesome 6, Chart.js |
| **Backend** | Node.js (v18+), Express.js |
| **Database** | SQLite3 (`iot.db` with automated indexing) |
| **Authentication** | JWT (JSON Web Tokens), `bcryptjs`, Secure Cookie / Bearer Header |
| **Timezone** | `+5:30 Asia/Kolkata` (Indian Standard Time) |
| **Hardware** | ESP8266 (NodeMCU/WeMos), DHT11, 16x2 I2C LCD, LED indicator |
| **Deployment Target** | Render (`render.yaml` blueprint included) |

---

## 📁 Repository Structure

```
iot/
├── .env.example                               # Environment variables template
├── .gitignore                                 # Git ignore file (excludes node_modules & db)
├── package.json                               # Dependencies & scripts ("start": "node server.js")
├── render.yaml                                # Render Blueprint for 1-click cloud deployment
├── database.js                                # SQLite schema initialization & query helpers
├── server.js                                  # Express API, authentication & microcontroller endpoints
├── test_api.js                                # Automated end-to-end testing script
├── public/                                    # Frontend Web Application
│   ├── index.html                             # Login & Registration Portal (Green Theme)
│   ├── dashboard.html                         # Main Dashboard with 3 Tabs
│   ├── css/
│   │   └── custom.css                         # Modern styling, gauges, seekbars, 16x2 LCD matrix font
│   └── js/
│       ├── auth.js                            # Login / Registration handling & session routing
│       └── dashboard.js                       # 10s telemetry polling, gauge/seekbar animations, Chart.js, LCD & LED
└── arduino/
    └── AshishVegan_ESP8266/
        └── AshishVegan_ESP8266.ino            # Full Arduino C++ firmware for ESP8266
```

---

## 🚀 Quick Start (Local Machine)

### 1. Prerequisites
Node.js (v18 or newer) is installed on your system.

### 2. Start the Server
Run the following in the project root:
```bash
npm start
```
The server will bind to `0.0.0.0:3000` and display:
- **Local Dashboard:** `http://localhost:3000`
- **Network IP:** `http://192.168.x.x:3000` (Use this in the ESP8266 code for local WiFi testing)

### 3. Open the Dashboard
Open `http://localhost:3000` in your web browser:
1. Click **Register** to create an account (e.g. `sayali@gceoy.edu`).
2. Log in and access the full monitoring and control dashboard.

---

## 🌐 Render Cloud Deployment Guide

This project is tailored specifically for **Render**:

### Method A: Deploy via GitHub (Recommended)
1. Push your `iot` directory to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for AshishVegan IoT"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint** (or **Web Service**):
   - If using **Blueprint**, select your repository; Render will automatically detect `render.yaml`!
   - If creating a manual **Web Service**:
     - **Environment:** `Node`
     - **Build Command:** `npm install && (npm rebuild sqlite3 --build-from-source || true)`
     - **Start Command:** `node server.js`
     - **Environment Variables:**
       - `NODE_ENV` = `production`
       - `JWT_SECRET` = `<any-random-secure-string>`
4. Click **Deploy Web Service**.
5. Render will assign you a live HTTPS URL (e.g. `https://ashishvegan-iot.onrender.com`).

---

## 🔌 Hardware Circuit & Pin Connections

| Component | Pin on Component | Pin on ESP8266 (NodeMCU) | Function |
|---|---|---|---|
| **DHT11 Sensor** | VCC | 3.3V or 5V | Power |
| **DHT11 Sensor** | GND | GND | Ground |
| **DHT11 Sensor** | Data / OUT | **D5 (GPIO 14)** | Sensor Data Output |
| **LED** | Anode (+) | **D6 (GPIO 12)** (via 220Ω resistor) | Output Control |
| **LED** | Cathode (-) | GND | Ground |
| **16x2 LCD I2C** | VCC | 5V (VIN) | Power |
| **16x2 LCD I2C** | GND | GND | Ground |
| **16x2 LCD I2C** | SCL | **D1 (GPIO 5)** | I2C Clock |
| **16x2 LCD I2C** | SDA | **D2 (GPIO 4)** | I2C Data |

---

## 🤖 Arduino ESP8266 Configuration

The Arduino code is located at:
`arduino/AshishVegan_ESP8266/AshishVegan_ESP8266.ino`

### 1. Arduino IDE Setup
1. In Arduino IDE, open **Tools > Manage Libraries...** and install:
   - **DHT sensor library** (by Adafruit)
   - **Adafruit Unified Sensor** (by Adafruit)
   - **LiquidCrystal I2C** (by Frank de Brabander or Marco Schwartz)
   - **ArduinoJson** (by Benoit Blanchon, v6 or v7)
2. Select your board: **Tools > Board > ESP8266 Boards > NodeMCU 1.0 (ESP-12E Module)**.

### 2. Configure WiFi & Cloud URL
In `AshishVegan_ESP8266.ino`:
```cpp
// WiFi Configuration (Pre-configured as requested)
const char* ssid     = "IoT";
const char* password = "12345678";

// Server Configuration
// For local testing: "http://192.168.10.63:3000"
// For Render Cloud:   "https://ashishvegan-iot.onrender.com"
const char* serverBaseUrl = "https://YOUR-RENDER-APP-NAME.onrender.com";
```
3. Upload the sketch to your ESP8266!

---

## 🖥️ Web Dashboard Features

### 1. Tab 1: Environment Monitoring
- **10-Second Telemetry Sync:** Auto-refreshes data every 10 seconds from the DHT11 sensor with a live countdown indicator.
- **Section 1 (Innovative Gauges & Seek Bars):**
  - **Ambient Temperature:** Circular SVG radial gauge (0°C to 50°C), live °F conversion, status indicator (`Cool`, `Optimal`, `Warm`, `High Heat`), and dynamic progress Seek Bar slider.
  - **Relative Humidity:** Circular radial gauge (0% to 100%), comfort analysis (`Dry`, `Comfortable`, `Humid`), and dynamic Seek Bar with ideal band highlights (40%-60%).
- **Interactive Telemetry Trend Graph:** Real-time Chart.js dual-axis graph plotting Temperature and Humidity over time.
- **Section 2 (Saved Records Table):**
  - Table columns: `# | Temperature | Humidity | Time (IST) | Date (IST) | Action (Delete)`
  - Formatted strictly in **+5:30 Asia/Kolkata (IST)**.
  - **Pagination:** Displays 20 records at a time with latest records first, Previous/Next navigation, and page indicators.
  - **Delete Record:** Instant row deletion with confirmation modal.
  - **Export CSV:** One-click download of all sensor records.
  - **Simulate Button:** Test and demo gauges, graphs, and tables immediately even when hardware is offline.

### 2. Tab 2: Smart LCD Display
- Input fields:
  - `Row 1: <input maxlength="16">` (Character counter: 0/16)
  - `Row 2: <input maxlength="16">` (Character counter: 0/16)
- **Virtual 16x2 LCD Matrix Preview:** Live simulation of the physical HD44780 LCD with realistic green matrix styling and character guidelines.
- **Update Button:** Updates the cloud database; ESP8266 fetches and updates the physical LCD screen.
- **Quick Preset Messages:** Instant 1-click presets for demonstrations.

### 3. Tab 3: LED Automation
- **Master Toggle Button:** Turn LED ON or OFF with responsive tactile animation.
- **Visual LED Lamp Simulator:** Realistic bulb with glowing green halo and status indicator (`ACTIVE (ON) / 3.3V Logic` vs `STANDBY (OFF) / 0V Logic`).
- Controls ESP8266 hardware pin **D6 (GPIO 12)** in real time.

---

## 🔒 Security & Persistence
- Passwords are salt-hashed using `bcryptjs`.
- Stateless JWT tokens stored in both HTTP cookies and client storage.
- SQLite database stored in `./data/iot.db`.

---

## 📜 Credits & Attribution
**AshishVegan IoT Smart Environmental Monitoring & Automation Platform**  
*Designed and Developed by Sayali Randive , Dept. of Electrical Engineering,  GCEOY*
