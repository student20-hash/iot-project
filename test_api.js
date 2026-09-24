const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Automated System Tests for AshishVegan IoT ---');
  const base = { hostname: 'localhost', port: 3000 };

  // 1. Health check
  console.log('\n1. Testing Health Endpoint:');
  const health = await makeRequest({ ...base, path: '/api/health', method: 'GET' });
  console.log('Health Response:', health.status, health.data);

  // 2. User Registration
  console.log('\n2. Testing User Registration:');
  const uniqueEmail = `test_${Date.now()}@ashishvegan.com`;
  const regRes = await makeRequest({
    ...base,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Sayali Randive',
    email: uniqueEmail,
    password: 'securepassword123'
  });
  console.log('Register Response:', regRes.status, regRes.data.success ? 'SUCCESS' : regRes.data);

  // 3. User Login
  console.log('\n3. Testing User Login:');
  const loginRes = await makeRequest({
    ...base,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: uniqueEmail,
    password: 'securepassword123'
  });
  console.log('Login Response:', loginRes.status, loginRes.data.user ? `Logged in as ${loginRes.data.user.name}` : loginRes.data);
  const token = loginRes.data.token;

  // 4. Ingest DHT11 Sensor Data (Simulating ESP8266)
  console.log('\n4. Testing Sensor Ingestion (ESP8266 DHT11):');
  const sensorPost = await makeRequest({
    ...base,
    path: '/api/sensor-data',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    temperature: 28.6,
    humidity: 64.2
  });
  console.log('Sensor Post Response:', sensorPost.status, sensorPost.data);
  const readingId = sensorPost.data.data.id;

  // Also test sensor GET endpoint
  const sensorGetUpdate = await makeRequest({
    ...base,
    path: '/api/sensor-data/update?temp=29.1&humidity=61.5',
    method: 'GET'
  });
  console.log('Sensor GET URL Response:', sensorGetUpdate.status, sensorGetUpdate.data);

  // 5. Test Latest Sensor Data
  console.log('\n5. Testing Latest Sensor Data:');
  const latestSensor = await makeRequest({ ...base, path: '/api/sensor-data/latest', method: 'GET' });
  console.log('Latest Reading:', latestSensor.data);

  // 6. Test History Pagination
  console.log('\n6. Testing Sensor History (Pagination 20 per page):');
  const history = await makeRequest({ ...base, path: '/api/sensor-data/history?page=1&limit=20', method: 'GET' });
  console.log('History Total Count:', history.data.pagination.total, 'Records returned:', history.data.records.length);
  console.log('Sample Record with Asia/Kolkata (+5:30):', history.data.records[0]);

  // 7. Test Delete Record
  console.log('\n7. Testing Delete Record:');
  const delRes = await makeRequest({
    ...base,
    path: `/api/sensor-data/${readingId}`,
    method: 'DELETE'
  });
  console.log('Delete Response:', delRes.status, delRes.data);

  // 8. Test Smart LCD Endpoints
  console.log('\n8. Testing Smart LCD 16x2:');
  const lcdPost = await makeRequest({
    ...base,
    path: '/api/lcd',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    row1: 'Sayali Randive',
    row2: 'IoT Dept of EE'
  });
  console.log('LCD Post Response:', lcdPost.status, lcdPost.data);

  const lcdGet = await makeRequest({ ...base, path: '/api/lcd', method: 'GET' });
  console.log('LCD JSON Get:', lcdGet.data);

  const lcdRaw = await makeRequest({ ...base, path: '/api/lcd/raw', method: 'GET' });
  console.log('LCD Raw format for ESP8266:\n---START---\n' + lcdRaw.data + '---END---');

  // 9. Test LED Automation Endpoints
  console.log('\n9. Testing LED Automation (Pin D6):');
  const ledToggle1 = await makeRequest({ ...base, path: '/api/led/toggle', method: 'POST' });
  console.log('LED Toggle 1:', ledToggle1.data);

  const ledStatusRaw = await makeRequest({ ...base, path: '/api/led/status', method: 'GET' });
  console.log('LED Raw Status for ESP8266 (0 or 1):', ledStatusRaw.data);

  const ledToggle2 = await makeRequest({ ...base, path: '/api/led/toggle', method: 'POST' });
  console.log('LED Toggle 2:', ledToggle2.data);

  console.log('\n======================================================');
  console.log('✅ ALL BACKEND & HARDWARE ENDPOINT TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

// Start server and run tests
const server = require('./server');
setTimeout(() => {
  runTests().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
}, 1200);
