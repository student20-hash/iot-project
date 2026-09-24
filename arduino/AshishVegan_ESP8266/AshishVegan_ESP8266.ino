/**
 * ======================================================================================
 * Project Name: AshishVegan IoT Smart Environmental Monitoring & Automation Platform
 * Designed and Developed by Sayali Randive , Dept. of Electrical Engineering,  GCEOY
 * ======================================================================================
 * 
 * Hardware Model & Pin Connections (NodeMCU / ESP8266):
 * --------------------------------------------------------------------------------------
 * 1. DHT11 Sensor:
 *    - VCC      -> 3.3V or 5V
 *    - GND      -> GND
 *    - Data/Out -> D5 (GPIO 14)
 * 
 * 2. LED:
 *    - Anode (+)-> D6 (GPIO 12) (via 220Ω resistor)
 *    - Cathode(-)-> GND
 * 
 * 3. 16x2 I2C LCD Display:
 *    - VCC      -> 5V (VIN on NodeMCU)
 *    - GND      -> GND
 *    - SDA      -> D2 (GPIO 4)
 *    - SCL      -> D1 (GPIO 5)
 *    Default I2C Address: 0x27 (if text does not appear, change to 0x3F)
 * 
 * Required Libraries (Install via Arduino IDE Library Manager):
 * --------------------------------------------------------------------------------------
 * 1. "DHT sensor library" by Adafruit
 * 2. "Adafruit Unified Sensor" by Adafruit
 * 3. "LiquidCrystal I2C" by Frank de Brabander or Marco Schwartz
 * 4. "ArduinoJson" by Benoit Blanchon (Supports both v6 and v7)
 * ======================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ======================================================================================
// 1. WIFI CREDENTIALS (Pre-configured)
// ======================================================================================
const char* ssid     = "IoT";
const char* password = "12345678";

// ======================================================================================
// 2. SERVER URL CONFIGURATION
// For Render Cloud deployment:
//    "https://YOUR-RENDER-APP-NAME.onrender.com"
// For Local Testing on the same Wi-Fi network:
//    "http://192.168.10.63:3000"
// ======================================================================================
const char* serverBaseUrl = "https://YOUR-RENDER-APP-NAME.onrender.com";

// ======================================================================================
// 3. HARDWARE PIN DEFINITIONS
// ======================================================================================
#define DHTPIN        D5      // DHT11 Data Pin (GPIO 14)
#define DHTTYPE       DHT11   // DHT 11 sensor model
#define LED_PIN       D6      // LED Control Pin (GPIO 12)
#define I2C_SDA       D2      // LCD I2C SDA Pin (GPIO 4)
#define I2C_SCL       D1      // LCD I2C SCL Pin (GPIO 5)
#define LCD_I2C_ADDR  0x27    // Standard I2C address (0x27 or 0x3F)

// Hardware Objects
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// Non-blocking Timer Intervals
unsigned long lastSensorPostTime = 0;
const unsigned long SENSOR_INTERVAL = 10000; // 10 Seconds interval as requested

unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 3000;    // Poll LCD text and LED state every 3 seconds

// Caching to eliminate screen flicker and redundant GPIO writes
String cachedRow1 = "";
String cachedRow2 = "";
int cachedLedState = -1;

// ======================================================================================
// SETUP
// ======================================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println(F("========================================================="));
  Serial.println(F("   AshishVegan IoT Environmental & Control Platform      "));
  Serial.println(F("   Designed & Developed by Sayali Randive, GCEOY         "));
  Serial.println(F("========================================================="));

  // Initialize LED Pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Default to OFF

  // Initialize I2C Bus for ESP8266 with D2 (SDA) and D1 (SCL)
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize 16x2 LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AshishVegan IoT");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");

  // Initialize DHT11
  dht.begin();

  // Connect to WiFi network
  connectWiFi();
}

// ======================================================================================
// MAIN LOOP
// ======================================================================================
void loop() {
  // Auto-reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long currentMillis = millis();

  // 1. Post DHT11 Sensor Data every 10 seconds
  if (currentMillis - lastSensorPostTime >= SENSOR_INTERVAL) {
    lastSensorPostTime = currentMillis;
    postSensorData();
  }

  // 2. Poll LED Automation and Smart LCD updates every 3 seconds
  if (currentMillis - lastPollTime >= POLL_INTERVAL) {
    lastPollTime = currentMillis;
    pollLedState();
    pollLcdText();
  }

  yield(); // Keep ESP8266 background WiFi stack responsive
}

// ======================================================================================
// WIFI CONNECTION ROUTINE
// ======================================================================================
void connectWiFi() {
  Serial.print(F("[WiFi] Connecting to SSID: "));
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(F("[WiFi] Connected successfully!"));
    Serial.print(F("[WiFi] NodeMCU IP: "));
    Serial.println(WiFi.localIP());

    // Display Connection Success on LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);

    // Initial Standby Message
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("AshishVegan IoT");
    lcd.setCursor(0, 1);
    lcd.print("System Ready");
  } else {
    Serial.println();
    Serial.println(F("[WiFi] Connection failed! Retrying in loop..."));
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Conn Failed");
    lcd.setCursor(0, 1);
    lcd.print("Check SSID/Pass");
  }
}

// ======================================================================================
// 1. READ & POST DHT11 SENSOR DATA (EVERY 10 SECONDS)
// ======================================================================================
void postSensorData() {
  if (WiFi.status() != WL_CONNECTED) return;

  // Read Sensor
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // Degrees Celsius

  // Retry once if DHT11 returned transient NaN
  if (isnan(humidity) || isnan(temperature)) {
    delay(100);
    humidity = dht.readHumidity();
    temperature = dht.readTemperature();
  }

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println(F("[DHT11] Warning: Failed to read from DHT11 on Pin D5. Check wiring."));
    return;
  }

  Serial.println(F("--------------------------------------------------"));
  Serial.print(F("[DHT11] Temperature: "));
  Serial.print(temperature, 1);
  Serial.print(F(" *C | Humidity: "));
  Serial.print(humidity, 1);
  Serial.println(F(" %"));

  // Robust Client Scoping (Prevents memory crash on ESP8266 HTTPS)
  WiFiClient client;
  WiFiClientSecure secureClient;
  HTTPClient http;

  String endpoint = String(serverBaseUrl) + "/api/sensor-data";
  bool isHttps = endpoint.startsWith("https");

  if (isHttps) {
    secureClient.setInsecure(); // Bypass SSL fingerprint check on microcontrollers
    http.begin(secureClient, endpoint);
  } else {
    http.begin(client, endpoint);
  }

  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON body safely without memory overhead
  String requestBody = "{\"temperature\":" + String(temperature, 1) + ",\"humidity\":" + String(humidity, 1) + "}";

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    Serial.print(F("[Sensor POST] Server Response: "));
    Serial.println(httpCode);
  } else {
    Serial.print(F("[Sensor POST] Failed. HTTP Error: "));
    Serial.println(http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ======================================================================================
// 2. POLL LED STATE (D6)
// ======================================================================================
void pollLedState() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  WiFiClientSecure secureClient;
  HTTPClient http;

  String endpoint = String(serverBaseUrl) + "/api/led/status";
  bool isHttps = endpoint.startsWith("https");

  if (isHttps) {
    secureClient.setInsecure();
    http.begin(secureClient, endpoint);
  } else {
    http.begin(client, endpoint);
  }

  http.setTimeout(3000);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    payload.trim();

    // Plain text endpoint returns "1" (ON) or "0" (OFF)
    int state = payload.toInt();

    if (state != cachedLedState) {
      cachedLedState = state;
      digitalWrite(LED_PIN, state == 1 ? HIGH : LOW);

      Serial.print(F("[LED D6] Switched to: "));
      Serial.println(state == 1 ? F("HIGH (ON)") : F("LOW (OFF)"));
    }
  }

  http.end();
}

// ======================================================================================
// 3. POLL SMART LCD 16x2 TEXT (D1/SCL, D2/SDA)
// ======================================================================================
void pollLcdText() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  WiFiClientSecure secureClient;
  HTTPClient http;

  // Uses raw text endpoint for maximum reliability across all ArduinoJson versions
  // Raw endpoint returns line 1 followed by newline and line 2
  String endpoint = String(serverBaseUrl) + "/api/lcd/raw";
  bool isHttps = endpoint.startsWith("https");

  if (isHttps) {
    secureClient.setInsecure();
    http.begin(secureClient, endpoint);
  } else {
    http.begin(client, endpoint);
  }

  http.setTimeout(3000);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();

    // Parse Row 1 and Row 2 separated by newline '\n'
    int newlinePos = payload.indexOf('\n');
    String r1 = "";
    String r2 = "";

    if (newlinePos != -1) {
      r1 = payload.substring(0, newlinePos);
      r2 = payload.substring(newlinePos + 1);
    } else {
      r1 = payload;
      r2 = "";
    }

    // Clean up trailing whitespace/newlines
    r1.replace("\r", "");
    r2.replace("\r", "");
    r1.trim();
    r2.trim();

    // Update physical LCD only when content actually changes
    if (r1 != cachedRow1 || r2 != cachedRow2) {
      cachedRow1 = r1;
      cachedRow2 = r2;

      Serial.println(F("[LCD 16x2] Updating screen:"));
      Serial.print(F("  Line 1: \""));
      Serial.print(r1);
      Serial.println(F("\""));
      Serial.print(F("  Line 2: \""));
      Serial.print(r2);
      Serial.println(F("\""));

      // Pad strings to 16 characters with spaces to completely clear old characters
      while (r1.length() < 16) r1 += " ";
      while (r2.length() < 16) r2 += " ";

      lcd.setCursor(0, 0);
      lcd.print(r1.substring(0, 16));

      lcd.setCursor(0, 1);
      lcd.print(r2.substring(0, 16));
    }
  }

  http.end();
}
