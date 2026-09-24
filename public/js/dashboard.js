// AshishVegan IoT - Main Dashboard Logic
// Real-time telemetry, Gauges, Seek-bars, Paginated Records, Smart LCD, and LED Automation

let currentPage = 1;
let totalPages = 1;
let sensorChart = null;
let countdownTimer = null;
let currentSeconds = 10;
let pendingDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify User Authentication
  const token = localStorage.getItem('ashishvegan_token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) {
      localStorage.removeItem('ashishvegan_token');
      localStorage.removeItem('ashishvegan_user');
      window.location.href = '/index.html';
      return;
    }

    // Populate user info
    if (data.user) {
      document.getElementById('navUserName').innerText = data.user.name || 'User';
      document.getElementById('navUserEmail').innerText = data.user.email || '';
    }
  } catch (err) {
    console.warn('Auth check skipped or offline:', err);
  }

  // 2. Start Live Clock in Asia/Kolkata (+5:30)
  startKolkataClock();

  // 3. Initialize Chart
  initSensorChart();

  // 4. Initial Data Load
  await fetchLatestSensorData();
  await fetchRecords(1);
  await fetchChartData();
  await fetchLcdData();
  await fetchLedStatus();

  // 5. Start 10-Second Telemetry Sync Loop
  startTelemetryLoop();
});

// ==========================================
// CLOCK & TIMEZONE (ASIA/KOLKATA +5:30)
// ==========================================
function startKolkataClock() {
  const clockEl = document.getElementById('liveClock');
  function update() {
    const now = new Date();
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

    const timeStr = new Intl.DateTimeFormat('en-IN', timeOptions).format(now);
    const dateStr = new Intl.DateTimeFormat('en-IN', dateOptions).format(now);

    if (clockEl) {
      clockEl.innerText = `${dateStr}, ${timeStr}`;
    }
  }
  update();
  setInterval(update, 1000);
}

// Global Logout
window.logoutUser = async function() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('ashishvegan_token');
  localStorage.removeItem('ashishvegan_user');
  window.location.href = '/index.html';
};

// ==========================================
// TAB SWITCHING LOGIC
// ==========================================
window.switchTab = function(tabName) {
  const tabs = ['env', 'lcd', 'led'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    
    if (t === tabName) {
      btn.classList.add('active');
      btn.classList.remove('text-emerald-400/70', 'hover:text-white');
      content.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      btn.classList.add('text-emerald-400/70', 'hover:text-white');
      content.classList.add('hidden');
    }
  });

  if (tabName === 'env' && sensorChart) {
    sensorChart.resize();
  }
};

// ==========================================
// TAB 1: SENSOR TELEMETRY & INNOVATIVE GAUGES
// ==========================================
function startTelemetryLoop() {
  currentSeconds = 10;
  const countEl = document.getElementById('countdownSeconds');
  const pollText = document.getElementById('pollStatusText');

  clearInterval(countdownTimer);
  countdownTimer = setInterval(async () => {
    currentSeconds--;
    if (countEl) countEl.innerText = currentSeconds;

    if (currentSeconds <= 0) {
      currentSeconds = 10;
      if (pollText) pollText.innerText = 'Syncing...';
      await fetchLatestSensorData();
      await fetchChartData();
      await fetchRecords(currentPage, false);
      if (pollText) pollText.innerText = 'Syncing 10s';
    }
  }, 1000);
}

// Fetch Latest Sensor Reading
async function fetchLatestSensorData() {
  try {
    const res = await fetch('/api/sensor-data/latest');
    const result = await res.json();

    if (result.success && result.data) {
      updateGaugesAndSeekBars(result.data.temperature, result.data.humidity);
    }
  } catch (err) {
    console.error('Error fetching latest sensor data:', err);
  }
}

// Update Innovative Radial Gauges & Seek Bars
function updateGaugesAndSeekBars(temp, hum) {
  // 1. Temperature Calculation (0 to 50°C scale)
  const tempVal = Number(temp);
  const tempIntEl = document.getElementById('gaugeTempInt');
  const tempFEl = document.getElementById('gaugeTempF');
  const tempCircle = document.getElementById('tempGaugeCircle');
  const tempFill = document.getElementById('tempSeekBarFill');
  const tempThumb = document.getElementById('tempSeekBarThumb');
  const tempPercentEl = document.getElementById('seekBarPercentTemp');
  const tempBadge = document.getElementById('tempStatusBadge');

  if (tempIntEl) tempIntEl.innerText = tempVal.toFixed(1);
  if (tempFEl) {
    const fahrenheit = ((tempVal * 9/5) + 32).toFixed(1);
    tempFEl.innerText = `${fahrenheit} °F`;
  }

  // Max 50°C
  const tempPercent = Math.min(100, Math.max(0, (tempVal / 50) * 100));
  if (tempPercentEl) tempPercentEl.innerText = `${Math.round(tempPercent)}%`;

  // SVG Radial Arc (Circumference = 2 * PI * 64 = ~402)
  const totalDash = 402;
  const offset = totalDash - (totalDash * (tempPercent / 100));
  if (tempCircle) tempCircle.style.strokeDashoffset = offset;

  // Seek Bar Level
  if (tempFill) tempFill.style.width = `${tempPercent}%`;
  if (tempThumb) tempThumb.style.left = `${tempPercent}%`;

  // Status Badge
  if (tempBadge) {
    if (tempVal < 20) {
      tempBadge.innerText = 'Cool';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold font-mono';
    } else if (tempVal <= 29) {
      tempBadge.innerText = 'Optimal';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-semibold font-mono';
    } else if (tempVal <= 36) {
      tempBadge.innerText = 'Warm';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-amber-950 border border-amber-500/40 text-amber-300 font-semibold font-mono';
    } else {
      tempBadge.innerText = 'High Heat';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-red-950 border border-red-500/40 text-red-300 font-semibold font-mono';
    }
  }

  // 2. Humidity Calculation (0 to 100% scale)
  const humVal = Number(hum);
  const humIntEl = document.getElementById('gaugeHumInt');
  const humCircle = document.getElementById('humGaugeCircle');
  const humFill = document.getElementById('humSeekBarFill');
  const humThumb = document.getElementById('humSeekBarThumb');
  const humPercentEl = document.getElementById('seekBarPercentHum');
  const humBadge = document.getElementById('humStatusBadge');

  if (humIntEl) humIntEl.innerText = humVal.toFixed(1);

  const humPercent = Math.min(100, Math.max(0, humVal));
  if (humPercentEl) humPercentEl.innerText = `${Math.round(humPercent)}%`;

  const humOffset = totalDash - (totalDash * (humPercent / 100));
  if (humCircle) humCircle.style.strokeDashoffset = humOffset;

  if (humFill) humFill.style.width = `${humPercent}%`;
  if (humThumb) humThumb.style.left = `${humPercent}%`;

  // Humidity Badge
  if (humBadge) {
    if (humVal < 40) {
      humBadge.innerText = 'Dry';
      humBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-amber-950 border border-amber-500/40 text-amber-300 font-semibold font-mono';
    } else if (humVal <= 65) {
      humBadge.innerText = 'Comfortable';
      humBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-teal-950 border border-teal-500/40 text-teal-300 font-semibold font-mono';
    } else {
      humBadge.innerText = 'Humid';
      humBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-blue-950 border border-blue-500/40 text-blue-300 font-semibold font-mono';
    }
  }
}

// Simulate Sensor Reading
window.simulateReading = async function() {
  const btn = document.getElementById('simulateBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

  try {
    const res = await fetch('/api/sensor-data/simulate', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.data) {
      updateGaugesAndSeekBars(data.data.temperature, data.data.humidity);
      await fetchRecords(currentPage);
      await fetchChartData();
    }
  } catch (err) {
    console.error('Simulation failed:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Simulate</span>';
  }
};

// ==========================================
// PAGINATED SAVED RECORDS TABLE (20 PER PAGE)
// ==========================================
async function fetchRecords(page = 1, showLoading = true) {
  currentPage = page;
  const tbody = document.getElementById('recordsTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (showLoading && tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-emerald-400/60 font-mono text-xs">
          <i class="fa-solid fa-circle-notch fa-spin text-base mr-2"></i> Loading records...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`/api/sensor-data/history?page=${page}&limit=20`);
    const data = await res.json();

    if (!data.success || !data.records || data.records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-emerald-400/50 font-mono text-xs">
            No sensor readings saved yet. ESP8266 or "Simulate" will record readings here.
          </td>
        </tr>
      `;
      if (paginationInfo) paginationInfo.innerText = 'Showing 0 to 0 of 0 records';
      if (pageIndicator) pageIndicator.innerText = 'Page 1 of 1';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const { total, totalPages: pages, limit } = data.pagination;
    totalPages = pages;

    const startIdx = (currentPage - 1) * limit + 1;
    const endIdx = Math.min(currentPage * limit, total);
    if (paginationInfo) paginationInfo.innerText = `Showing ${startIdx} to ${endIdx} of ${total} records`;
    if (pageIndicator) pageIndicator.innerText = `Page ${currentPage} of ${totalPages}`;

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    // Render Table Rows
    let rowsHtml = '';
    data.records.forEach(r => {
      rowsHtml += `
        <tr class="hover:bg-emerald-950/40 transition-colors border-b border-emerald-950/60">
          <td class="py-3 px-4 font-bold text-emerald-400">#${r.id}</td>
          <td class="py-3 px-4 text-white font-semibold flex items-center space-x-1.5">
            <i class="fa-solid fa-temperature-three-quarters text-orange-400 text-xs"></i>
            <span>${r.temperature} °C</span>
          </td>
          <td class="py-3 px-4 text-teal-300 font-semibold">
            <span class="inline-flex items-center space-x-1">
              <i class="fa-solid fa-droplet text-cyan-400 text-xs"></i>
              <span>${r.humidity} %</span>
            </span>
          </td>
          <td class="py-3 px-4 text-emerald-300/90">${r.time}</td>
          <td class="py-3 px-4 text-emerald-400/70">${r.date}</td>
          <td class="py-3 px-4 text-center">
            <button 
              onclick="openDeleteModal(${r.id})" 
              class="px-2.5 py-1 rounded-lg bg-red-950/50 hover:bg-red-800 text-red-300 hover:text-white border border-red-800/40 text-[11px] font-sans font-medium transition flex items-center mx-auto space-x-1"
              title="Delete Record #${r.id}"
            >
              <i class="fa-regular fa-trash-can"></i>
              <span>Delete</span>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error('Error fetching records:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-red-400/80 font-mono text-xs">
          <i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Failed to load records from server.
        </td>
      </tr>
    `;
  }
}

window.changePage = function(delta) {
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    fetchRecords(newPage);
  }
};

// ==========================================
// DELETE RECORD MODAL & ACTION
// ==========================================
window.openDeleteModal = function(id) {
  pendingDeleteId = id;
  const modal = document.getElementById('deleteModal');
  const idEl = document.getElementById('deleteRecordId');
  if (idEl) idEl.innerText = `#${id}`;
  if (modal) modal.classList.remove('hidden');
};

window.closeDeleteModal = function() {
  pendingDeleteId = null;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.add('hidden');
};

window.executeDeleteRecord = async function() {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.innerText = 'Deleting...';

  try {
    const res = await fetch(`/api/sensor-data/${pendingDeleteId}`, { method: 'DELETE' });
    const data = await res.json();
    closeDeleteModal();
    if (data.success) {
      await fetchRecords(currentPage);
      await fetchLatestSensorData();
      await fetchChartData();
    }
  } catch (err) {
    console.error('Delete error:', err);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Delete Permanently';
  }
};

// Export CSV of records
window.exportTableCSV = async function() {
  try {
    const res = await fetch('/api/sensor-data/history?page=1&limit=500');
    const data = await res.json();
    if (!data.success || !data.records || data.records.length === 0) {
      alert('No records available to export.');
      return;
    }

    let csv = 'ID,Temperature (°C),Humidity (%),Time (IST),Date (IST)\n';
    data.records.forEach(r => {
      csv += `${r.id},${r.temperature},${r.humidity},"${r.time}","${r.date}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AshishVegan_Sensor_Records_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export CSV error:', err);
  }
};

// ==========================================
// TELEMETRY TRENDS GRAPH (CHART.JS)
// ==========================================
function initSensorChart() {
  const ctx = document.getElementById('sensorTrendsChart');
  if (!ctx) return;

  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10b981',
          pointHoverRadius: 6,
          fill: true,
          yAxisID: 'yTemp'
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#06b6d4',
          pointHoverRadius: 6,
          fill: true,
          yAxisID: 'yHum'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(5, 20, 14, 0.95)',
          titleColor: '#34d399',
          bodyColor: '#ecfdf5',
          borderColor: 'rgba(52, 211, 153, 0.3)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(21, 47, 35, 0.6)'
          },
          ticks: {
            color: '#6ee7b7',
            font: { family: 'monospace', size: 10 },
            maxRotation: 45
          }
        },
        yTemp: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 50,
          grid: {
            color: 'rgba(21, 47, 35, 0.6)'
          },
          ticks: {
            color: '#10b981',
            font: { family: 'monospace', size: 10 },
            callback: value => `${value}°C`
          }
        },
        yHum: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 100,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: '#06b6d4',
            font: { family: 'monospace', size: 10 },
            callback: value => `${value}%`
          }
        }
      }
    }
  });
}

async function fetchChartData() {
  if (!sensorChart) return;

  try {
    const res = await fetch('/api/sensor-data/chart');
    const result = await res.json();

    if (result.success && result.data) {
      sensorChart.data.labels = result.data.labels;
      sensorChart.data.datasets[0].data = result.data.temperatures;
      sensorChart.data.datasets[1].data = result.data.humidities;
      sensorChart.update();
    }
  } catch (err) {
    console.error('Error updating chart:', err);
  }
}

// ==========================================
// TAB 2: SMART LCD 16x2 CONTROLLER
// ==========================================
async function fetchLcdData() {
  try {
    const res = await fetch('/api/lcd');
    const data = await res.json();
    if (data.success) {
      const r1 = data.row1 || '';
      const r2 = data.row2 || '';

      const input1 = document.getElementById('lcdInputRow1');
      const input2 = document.getElementById('lcdInputRow2');
      if (input1) input1.value = r1;
      if (input2) input2.value = r2;

      updateLcdVirtualPreview(r1, r2);
      updateCharCounters(r1.length, r2.length);

      const timeEl = document.getElementById('lcdLastUpdated');
      if (timeEl && data.updated_time) {
        timeEl.innerText = data.updated_time;
      }
    }
  } catch (err) {
    console.error('Error fetching LCD data:', err);
  }
}

window.handleLcdInput = function(row) {
  const input1 = document.getElementById('lcdInputRow1');
  const input2 = document.getElementById('lcdInputRow2');
  const r1 = input1 ? input1.value : '';
  const r2 = input2 ? input2.value : '';

  updateLcdVirtualPreview(r1, r2);
  updateCharCounters(r1.length, r2.length);
};

function updateCharCounters(c1, c2) {
  const count1 = document.getElementById('charCountRow1');
  const count2 = document.getElementById('charCountRow2');
  if (count1) count1.innerText = `${c1}/16`;
  if (count2) count2.innerText = `${c2}/16`;
}

function updateLcdVirtualPreview(r1, r2) {
  const vRow1 = document.getElementById('lcdVirtualRow1');
  const vRow2 = document.getElementById('lcdVirtualRow2');

  const paddedR1 = (r1 || '').padEnd(16, ' ').substring(0, 16);
  const paddedR2 = (r2 || '').padEnd(16, ' ').substring(0, 16);

  if (vRow1) vRow1.innerText = paddedR1;
  if (vRow2) vRow2.innerText = paddedR2;
}

window.setLcdPreset = function(r1, r2) {
  const input1 = document.getElementById('lcdInputRow1');
  const input2 = document.getElementById('lcdInputRow2');
  if (input1) input1.value = r1;
  if (input2) input2.value = r2;
  updateLcdVirtualPreview(r1, r2);
  updateCharCounters(r1.length, r2.length);
};

window.updateLcdText = async function(event) {
  event.preventDefault();
  const input1 = document.getElementById('lcdInputRow1');
  const input2 = document.getElementById('lcdInputRow2');
  const btn = document.getElementById('lcdUpdateBtn');
  const toast = document.getElementById('lcdToastMsg');

  const row1 = input1 ? input1.value.substring(0, 16) : '';
  const row2 = input2 ? input2.value.substring(0, 16) : '';

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Sending to Cloud...';

  try {
    const res = await fetch('/api/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row1, row2 })
    });
    const data = await res.json();

    if (data.success) {
      updateLcdVirtualPreview(data.row1, data.row2);
      const timeEl = document.getElementById('lcdLastUpdated');
      if (timeEl && data.updated_time) {
        timeEl.innerText = data.updated_time;
      }
      if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 4000);
      }
    }
  } catch (err) {
    console.error('Update LCD error:', err);
    alert('Failed to update LCD display');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i><span>Update LCD Display</span>';
  }
};

// ==========================================
// TAB 3: LED AUTOMATION (PIN D6)
// ==========================================
async function fetchLedStatus() {
  try {
    const res = await fetch('/api/led');
    const data = await res.json();
    if (data.success) {
      applyLedVisualState(data.state === 1, data.updated_time);
    }
  } catch (err) {
    console.error('Error fetching LED state:', err);
  }
}

function applyLedVisualState(isOn, updatedTime) {
  const lamp = document.getElementById('ledBulbVisual');
  const icon = document.getElementById('ledBulbIcon');
  const halo = document.getElementById('ledHaloGlow');
  const dot = document.getElementById('ledStatusDot');
  const text = document.getElementById('ledStatusText');
  const btn = document.getElementById('ledToggleBtn');
  const btnText = document.getElementById('ledBtnText');
  const lastTime = document.getElementById('ledLastChanged');

  if (isOn) {
    // LED is ON
    if (lamp) {
      lamp.className = 'led-lamp active w-32 h-32 rounded-full border-4 flex items-center justify-center cursor-pointer transition-all duration-300';
    }
    if (icon) {
      icon.className = 'fa-solid fa-lightbulb text-4xl text-emerald-950 transition-colors duration-300';
    }
    if (halo) {
      halo.classList.remove('opacity-0');
      halo.classList.add('opacity-100');
    }
    if (dot) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse';
    }
    if (text) {
      text.innerText = 'LED IS ACTIVE (ON)';
      text.className = 'text-sm font-mono font-bold tracking-wider text-emerald-300 text-glow';
    }
    if (btn) {
      btn.className = 'w-full max-w-sm py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-base tracking-wide shadow-xl shadow-red-600/30 transition-all duration-200 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-3';
    }
    if (btnText) btnText.innerText = 'Turn LED OFF';
  } else {
    // LED is OFF
    if (lamp) {
      lamp.className = 'led-lamp inactive w-32 h-32 rounded-full border-4 flex items-center justify-center cursor-pointer transition-all duration-300';
    }
    if (icon) {
      icon.className = 'fa-solid fa-lightbulb text-4xl text-emerald-900/60 transition-colors duration-300';
    }
    if (halo) {
      halo.classList.remove('opacity-100');
      halo.classList.add('opacity-0');
    }
    if (dot) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-gray-600';
    }
    if (text) {
      text.innerText = 'LED IS STANDBY (OFF)';
      text.className = 'text-sm font-mono font-bold tracking-wider text-gray-400';
    }
    if (btn) {
      btn.className = 'w-full max-w-sm py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 font-extrabold text-base tracking-wide shadow-xl shadow-emerald-500/20 transition-all duration-200 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-3';
    }
    if (btnText) btnText.innerText = 'Turn LED ON';
  }

  if (lastTime && updatedTime) {
    lastTime.innerText = `Last switched: ${updatedTime}`;
  }
}

window.toggleLed = async function() {
  const btn = document.getElementById('ledToggleBtn');
  const btnText = document.getElementById('ledBtnText');
  btn.disabled = true;
  if (btnText) btnText.innerText = 'Switching...';

  try {
    const res = await fetch('/api/led/toggle', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      applyLedVisualState(data.state === 1, data.updated_time);
    }
  } catch (err) {
    console.error('Toggle error:', err);
  } finally {
    btn.disabled = false;
  }
};
