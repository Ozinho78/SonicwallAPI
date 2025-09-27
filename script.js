const baseUrl = "http://127.0.0.1:3000/api/sonicos";

// --- Auth ---
async function authenticate() {
  const statusEl = document.getElementById("auth-status");
  try {
    statusEl.textContent = "Authentifiziere zur SonicWall...";
    const res = await fetch(`${baseUrl}/auth`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ override: true })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Auth-Fehler ${res.status} - ${t}`);
    }
    statusEl.textContent = "Authentifizierung erfolgreich.";
    statusEl.classList.remove("error");
    return true;
  } catch (e) {
    console.error("Auth error:", e);
    statusEl.textContent = e.message || "Authentifizierung fehlgeschlagen.";
    statusEl.classList.add("error");
    return false;
  }
}


// Hilfsfunktion zum Laden

// --- Helpers ---
function parseUSDateTime(str) {
  // expects 'MM/DD/YYYY HH:mm:ss'
  if (!str) return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, mm, dd, yyyy, HH, MM, SS] = m;
  return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
}
function kvRow(key, value) {
  return `<div class="key">${key}</div><div>${value ?? "-"}</div>`;
}
function numberFromText(txt) {
  const n = String(txt ?? "").match(/([\d.]+)/);
  return n ? n[1] : (txt ?? "-");
}

async function fetchData(endpoint) {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP-Error ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`Fehler bei ${endpoint}:`, err);
    return null;
  }
}


// --- Systemstatus ---
async function loadSystemStatus() {
  const data = await fetchData("/reporting/status/system");
  const el = document.getElementById("system");

  if (!data) {
    el.textContent = "Keine Systemdaten.";
    return;
  }

  const sysTime = parseUSDateTime(data.system_time);
  const sysTimeStr = sysTime ? sysTime.toLocaleString() : data.system_time;

  const pills = [];
  pills.push(`<span class="pill">Model: ${data.model}</span>`);
  pills.push(`<span class="pill">FW: ${data.firmware_version}</span>`);
  pills.push(`<span class="pill">ROM: ${data.rom_version}</span>`);
  pills.push(`<span class="pill">WAN: ${data.primary_wan}</span>`);
  pills.push(`<span class="pill ${data.restart_required ? "warn" : ""}">${data.restart_required ? "Neustart erforderlich" : "Kein Neustart nötig"}</span>`);

  el.innerHTML = `
    <div class="pills">${pills.join("")}</div>
    <div class="kv">
      ${kvRow("Firewall-Name", data.firewall_name)}
      ${kvRow("Seriennummer", data.serial_number)}
      ${kvRow("GUID", data.guid)}
      ${kvRow("Product Code", data.product_code)}
      ${kvRow("Systemzeit", sysTimeStr)}
      ${kvRow("Uptime", data.up_time)}
      ${kvRow("Verbindungen (aktuell)", numberFromText(data.current_connections))}
      ${kvRow("Verbindungen (Peak)", numberFromText(data.peak_connections))}
      ${kvRow("Verbindungen (max)", numberFromText(data.max_connections))}
      ${kvRow("Allowed (max)", numberFromText(data.max_allowed_connections))}
      ${kvRow("Auslastung", data.connection_usage)}
      ${kvRow("Zuletzt geändert von", data.last_modified_by)}
      ${kvRow("Registrierungscode", data.registration_code)}
      ${kvRow("Global Mode", data.global_mode ? "Aktiv" : "Inaktiv")}
    </div>
  `;
}

// Firmware
async function loadDeviceInfo() {
  const data = await fetchData("/firmware/base");
  const container = document.getElementById("device-info");

  if (data && data.firmware) {
    container.innerHTML = `
      <p><strong>Version:</strong> ${data.firmware.version}</p>
      <p><strong>Build:</strong> ${data.firmware.build}</p>
      <p><strong>Model:</strong> ${data.firmware.model}</p>
    `;
  } else {
    container.innerText = "Keine Firmware-Daten.";
  }
}

// Interfaces (Reporting)
async function loadInterfaces() {
  const data = await fetchData("/reporting/status/interfaces");
  const container = document.getElementById("interfaces");

  if (Array.isArray(data) && data.length > 0) {
    let html = `
      <table>
        <thead>
          <tr><th>Name</th><th>IP-Adresse</th><th>Link-Status</th></tr>
        </thead>
        <tbody>
    `;
    data.forEach(iface => {
      html += `
        <tr>
          <td>${iface.name}</td>
          <td>${iface.ip_address}</td>
          <td>${iface.link_status}</td>
        </tr>
      `;
    });
    html += "</tbody></table>";
    container.innerHTML = html;
  } else {
    container.innerText = "Keine Interface-Daten.";
  }
}

// Administration
async function loadAdministration() {
  const data = await fetchData("/administration/global");
  const container = document.getElementById("administration");

  if (data && data.administration) {
    const adm = data.administration;
    container.innerHTML = `
      <p><strong>Firewall-Name:</strong> ${adm.firewall_name}</p>
      <p><strong>Admin:</strong> ${adm.admin?.name}</p>
      <p><strong>Idle-Logout:</strong> ${adm.idle_logout_time} min</p>
    `;
  } else {
    container.innerText = "Keine Admin-Daten.";
  }
}

// Logs
async function loadLogs() {
  const data = await fetchData("/log/display");
  const container = document.getElementById("logs");

  if (data && data.log?.display) {
    const log = data.log.display;
    container.innerHTML = `
      <p><strong>Zeitraum:</strong> letzte ${log.time_range?.last?.value} Minuten</p>
      <p><strong>Max. Anzahl:</strong> ${log.max_number}</p>
    `;
  } else {
    container.innerText = "Keine Log-Daten.";
  }
}

// Alles laden
async function reloadAll() {
  const okay = await authenticate();
  if (!okay) return;
  await loadSystemStatus();
  const ok = await authenticate();
  if (!ok) return;
  await loadDeviceInfo();
  await loadInterfaces();
  await loadAdministration();
  await loadLogs();
}

window.onload = reloadAll;
document.getElementById("reload").addEventListener("click", reloadAll);
