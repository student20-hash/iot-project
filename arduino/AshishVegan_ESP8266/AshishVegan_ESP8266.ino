/**
 * ======================================================================================
 * Project Name: AshishVegan IoT Smart Environmental Monitoring & Automation Platform
 * Designed and Developed by Sayali Randive , Dept. of Electrical Engineering,  GCEOY
 * ======================================================================================
 * 
 * Hardware Connections (NodeMCU / ESP8266):
 * --------------------------------------------------------------------------------------
 * 1. DHT11 Sensor:
 *    - VCC      -> 3.3V or 5V (depending on module)
 *    - GND      -> GND
 *    - Data/Out -> D5 (GPIO 14)
 * 
 * 2. LED:
 *    - Anode (+)-> D6 (GPIO 12) (via 220Ω - 330Ω current limiting resistor)
 *    - Cathode(-)-> GND
 * 
 * 3. 16x2 I2C LCD Display:
 *    - VCC      -> 5V (VIN on NodeMCU)
 *    - GND      -> GND
 *    - SDA      -> D2 (GPIO 4)
 *    - SCL      -> D1 (GPIO 5)
 *    Default I2C Address: 0x27 (or 0x3F)
 * 
 * Required Arduino Libraries (Install via Arduino IDE Library Manager):
 * 1. "DHT sensor library" by Adafruit (and "Adafruit Unified Sensor")
 * 2. "LiquidCrystal I2C" by Frank de Brabander or Marco Schwartz
 * 3. "ArduinoJson" by Benoit Blanchon (version 6.x or 7.x)
 * 4. "ESP8266WiFi" & "ESP8266HTTPClient" (Built into ESP8266 Board Package)
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
// 1. WIFI CONFIGURATION
// ======================================================================================
const char* ssid     = "IoT";
const char* password = "12345678";

// ======================================================================================
// 2. SERVER CONFIGURATION
// Replace with your Render URL (e.g. "https://ashishvegan-iot.onrender.com")
// OR your local machine IP for testing (e.g. "http://192.168.10.63:3000")
// ======================================================================================
const char* serverBaseUrl = "https://YOUR-RENDER-APP-NAME.onrender.com";

// ======================================================================================
// 3. PIN DEFINITIONS
// ======================================================================================
#define DHTPIN        D5      // DHT11 Data Pin (GPIO 14)
#define DHTTYPE       DHT11   // Sensor Model
#define LED_PIN       D6      // LED Pin (GPIO 12)
#define I2C_SDA       D2      // LCD I2C SDA (GPIO 4)
#define I2C_SCL       D1      // LCD I2C SCL (GPIO 5)
#define LCD_I2C_ADDR  0x27    // Change to 0x3F if your LCD doesn't show text

// Initialize Objects
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// Timers
unsigned long lastSensorPostTime = 0;
const unsigned long SENSOR_INTERVAL = 10000; // 10 Seconds interval as requested

unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 3000;    // Check LCD and LED state every 3 seconds

// State Caching
String cachedRow1 = "";
String cachedRow2 = "";
int cachedLedState = -1;

void setup() {
  // Initialize Serial Monitor
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("   AshishVegan IoT Environmental & Control Core   "));
  Serial.println(F("   Sayali Randive, Dept. of EE, GCEOY             "));
  Serial.println(F("=================================================="));

  // Initialize GPIO
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Start with LED OFF

  // Initialize I2C with ESP8266 Custom Pins (SDA=D2, SCL=D1)
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AshishVegan IoT");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");

  // Initialize DHT Sensor
  dht.begin();

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long currentMillis = millis();

  // 1. Read & Post DHT11 Sensor Data Every 10 Seconds
  if (currentMillis - lastSensorPostTime >= SENSOR_INTERVAL) {
    lastSensorPostTime = currentMillis;
    postSensorData();
  }

  // 2. Poll LED and LCD updates Every 3 Seconds
  if (currentMillis - lastPollTime >= POLL_INTERVAL) {
    lastPollTime = currentMillis;
    pollLedState();
    pollLcdText();
  }
}

// ======================================================================================
// WIFI CONNECTION ROUTINE
// ======================================================================================
void connectWiFi() {
  Serial.print(F("Connecting to WiFi: "));
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(F(">>> WiFi Connected successfully!"));
    Serial.print(F("IP Address: "));
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);

    // Initial Welcome on LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("AshishVegan IoT");
    lcd.setCursor(0, 1);
    lcd.print("GCEOY Ready");
  } else {
    Serial.println();
    Serial.println(F(">>> WiFi Connection Failed! Check SSID/Password."));
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Conn Failed");
    lcd.setCursor(0, 1);
    lcd.print("Retrying...");
  }
}

// ======================================================================================
// 1. POST DHT11 SENSOR DATA (EVERY 10 SECONDS)
// ======================================================================================
void postSensorData() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  // Check if DHT read failed
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println(F("[DHT11] Failed to read from sensor! Check wiring on Pin D5."));
    return;
  }

  Serial.println(F("--------------------------------------------------"));
  Serial.print(F("[DHT11] Temperature: "));
  Serial.print(temperature, 1);
  Serial.print(F(" °C | Humidity: "));
  Serial.print(humidity, 1);
  Serial.println(F(" %"));

  WiFiClient client;
  HTTPClient http;

  String endpoint = String(serverBaseUrl) + "/api/sensor-data";
  
  if (String(serverBaseUrl).startsWith("https")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Bypass SSL fingerprint validation on ESP8266
    http.begin(secureClient, endpoint);
  } else {
    http.begin(client, endpoint);
  }

  http.addHeader("Content-Type", "application/json");

  // Construct JSON payload
  StaticJsonDocument<128> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    Serial.print(F("[Sensor POST] Response Code: "));
    Serial.println(httpResponseCode);
  } else {
    Serial.print(F("[Sensor POST] Error: "));
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// ======================================================================================
// 2. POLL LED STATE (D6)
// ======================================================================================
void pollLedState() {
  WiFiClient client;
  HTTPClient http;

  String endpoint = String(serverBaseUrl) + "/api/led/status";

  if (String(serverBaseUrl).startsWith("https")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    http.begin(secureClient, endpoint);
  } else {
    http.begin(client, endpoint);
  }

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    payload.trim();
    int state = payload.toInt(); // "1" -> 1 (HIGH), "0" -> 0 (LOW)

    if (state != cachedLedState) {
      cachedLedState = state;
      digitalWrite(LED_PIN, state == 1 ? HIGH : LOW);

      Serial.print(F("[LED D6] State changed to: "));
      Serial.println(state == 1 ? F("HIGH (ON)") : F("LOW (OFF)"));
    }
  }

  http.end();
}

// ======================================================================================
// 3. POLL SMART LCD 16x2 TEXT (D1/SCL, D2/SDA)
// ======================================================================================
void pollLcdText() {
  WiFiClient client;
  HTTPClient http;

  String endpoint = String(serverBaseUrl) + "/api/lcd";

  if (String(serverBaseUrl).startsWith("https")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    http.begin(secureClient, endpoint);
  } else {
    http.begin(client, endpoint);
  }

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String r1 = doc["row1"] | "";
      String r2 = doc["row2"] | "";

      // Only re-write LCD if text has actually changed
      if (r1 != cachedRow1 || r2 != cachedRow2) {
        cachedRow1 = r1;
        cachedRow2 = r2;

        Serial.println(F("[LCD 16x2] New display content received:"));
        Serial.print(F("Row 1: \""));
        Serial.print(r1);
        Serial.println(F("\""));
        Serial.print(F("Row 2: \""));
        Serial.print(r2);
        Serial.println(F("\""));

        // Format to exact 16 chars with spaces to clear trailing old characters
        while (r1.length() < 16) r1 += " ";
        while (r2.length() < 16) r2 += " ";

        lcd.setCursor(0, 0);
        lcd.print(r1.substring(0, 16));

        lcd.setCursor(0, 1);
        lcd.print(r2.substring(0, 16));
      }
    }
  }

  http.end();
}
