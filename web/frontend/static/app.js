/* ── VoltGuard Frontend App ─────────────────────────────────────────────── */

let donutChart = null;
let barChart   = null;
let allRecords = [];

// ── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateFooterTime();
  setInterval(updateFooterTime, 1000);
  loadAll();
});

function updateFooterTime() {
  const el = document.getElementById("footer-time");
  if (el) el.textContent = new Date().toLocaleString();
}

// ── Load Data ───────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadStats(), loadDecisions()]);
}

async function loadStats() {
  try {
    const res  = await fetch("/api/stats");
    const data = await res.json();
    document.getElementById("stat-total").textContent      = data.total ?? "—";
    document.getElementById("stat-allow").textContent      = data.allow ?? "—";
    document.getElementById("stat-drop").textContent       = data.drop  ?? "—";
    document.getElementById("stat-allow-pct").textContent  = data.total ? `(${data.allow_pct}%)` : "";
    document.getElementById("stat-drop-pct").textContent   = data.total ? `(${data.drop_pct}%)` : "";
    renderDonut(data);
  } catch (e) {
    console.error("Stats load failed:", e);
  }
}

async function loadDecisions() {
  try {
    const res  = await fetch("/api/decisions");
    const data = await res.json();
    allRecords = data.records || [];
    renderTable(allRecords);
    renderBar(allRecords);
  } catch (e) {
    console.error("Decisions load failed:", e);
  }
}

// ── Run Pipeline ─────────────────────────────────────────────────────────────
function runPipeline() {
  const btn    = document.getElementById("btn-run");
  const badge  = document.getElementById("status-badge");
  const term   = document.getElementById("terminal");

  btn.disabled = true;
  badge.className  = "badge badge-running";
  badge.textContent = "Running…";
  term.innerHTML = "";
  addTermLine("info", "Connecting to pipeline...");

  const evtSource = new EventSource("/api/stream");

  evtSource.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      addTermLine(d.type || "info", d.msg || "");

      if (d.type === "done") {
        evtSource.close();
        badge.className  = "badge badge-done";
        badge.textContent = "Done";
        btn.disabled = false;
        loadAll();   // refresh data
      }
    } catch (_) {}
  };

  evtSource.onerror = () => {
    evtSource.close();
    badge.className  = "badge badge-error";
    badge.textContent = "Error";
    btn.disabled = false;
    addTermLine("error", "Connection lost or pipeline error.");
  };
}

function addTermLine(type, text) {
  const term = document.getElementById("terminal");
  const div  = document.createElement("div");
  div.className = `term-line ${type}`;
  div.textContent = text;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

function clearTerminal() {
  document.getElementById("terminal").innerHTML = "";
}

// ── Table ───────────────────────────────────────────────────────────────────
function renderTable(records) {
  const tbody = document.getElementById("table-body");
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-msg">No data — click ▶ Run Pipeline to generate results.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.device_id ?? "—"}</td>
      <td>${r.register ?? "—"}</td>
      <td><strong>${r.value ?? "—"}</strong></td>
      <td class="${r.pressure_bar > 12 ? "pressure-warn" : ""}">${fmt(r.pressure_bar)}</td>
      <td>${fmt(r.flow_rate)}</td>
      <td class="${r.state === "Catastrophic Failure" ? "state-fail" : "state-safe"}">${r.state ?? "—"}</td>
      <td><span class="${r.action === "ALLOW" ? "action-allow" : "action-drop"}">${r.action ?? "—"}</span></td>
      <td>${r.reason ?? "—"}</td>
    </tr>`
  ).join("");
}

function filterTable() {
  const text    = document.getElementById("filter-input").value.toLowerCase();
  const action  = document.getElementById("filter-action").value;
  const filtered = allRecords.filter(r => {
    const matchAction = !action || r.action === action;
    const matchText   = !text   || JSON.stringify(r).toLowerCase().includes(text);
    return matchAction && matchText;
  });
  renderTable(filtered);
}

function fmt(v) {
  return v !== undefined && v !== null ? Number(v).toFixed(3) : "—";
}

// ── Donut Chart ─────────────────────────────────────────────────────────────
function renderDonut(stats) {
  const ctx = document.getElementById("donutChart").getContext("2d");

  const allow = stats.allow || 0;
  const drop  = stats.drop  || 0;
  const total = stats.total || 0;

  document.getElementById("donut-center-text").innerHTML =
    total ? `<div style="font-size:1.6rem">${total}</div><div style="font-size:0.72rem;color:#8b949e;font-weight:400">total</div>` : "—";

  const data = {
    labels: ["ALLOW", "DROP"],
    datasets: [{
      data: [allow, drop],
      backgroundColor: ["#3fb950", "#f85149"],
      borderColor:     ["#1a4a22", "#4a1a1a"],
      borderWidth: 2,
      hoverOffset: 6,
    }]
  };

  if (donutChart) {
    donutChart.data = data;
    donutChart.update();
    return;
  }

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data,
    options: {
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8b949e", font: { size: 12 }, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} (${total ? ((ctx.parsed/total)*100).toFixed(1) : 0}%)`
          }
        }
      }
    }
  });
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function renderBar(records) {
  const ctx = document.getElementById("barChart").getContext("2d");

  if (!records.length) {
    if (barChart) { barChart.destroy(); barChart = null; }
    return;
  }

  const labels    = records.map((r, i) => `#${i+1} (v=${r.value})`);
  const pressures = records.map(r => r.pressure_bar);
  const flows     = records.map(r => r.flow_rate);
  const colors    = records.map(r => r.action === "DROP" ? "#f8514966" : "#3fb95066");
  const borders   = records.map(r => r.action === "DROP" ? "#f85149"   : "#3fb950");

  const data = {
    labels,
    datasets: [
      {
        label: "Pressure (bar)",
        data: pressures,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1.5,
        borderRadius: 4,
        yAxisID: "y",
      },
      {
        label: "Flow Rate",
        data: flows,
        type: "line",
        borderColor: "#58a6ff",
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#58a6ff",
        tension: 0.35,
        yAxisID: "y1",
      }
    ]
  };

  if (barChart) {
    barChart.data = data;
    barChart.update();
    return;
  }

  barChart = new Chart(ctx, {
    type: "bar",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#8b949e", font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return "";
              return `Action: ${records[idx]?.action ?? ""}`;
            }
          }
        },
        annotation: {}
      },
      scales: {
        x: {
          ticks: { color: "#8b949e", font: { size: 10 }, maxRotation: 45 },
          grid:  { color: "#21262d" }
        },
        y: {
          ticks: { color: "#8b949e" },
          grid:  { color: "#21262d" },
          title: { display: true, text: "Pressure (bar)", color: "#8b949e" }
        },
        y1: {
          position: "right",
          ticks: { color: "#58a6ff" },
          grid:  { drawOnChartArea: false },
          title: { display: true, text: "Flow Rate", color: "#58a6ff" }
        }
      }
    }
  });
}

/* ── API Panel ──────────────────────────────────────────────────────────── */

let apiPanelOpen = false;
let streamEventSource = null;

function toggleApiPanel() {
  apiPanelOpen = !apiPanelOpen;
  const panel  = document.getElementById("api-panel");
  const btn    = document.getElementById("btn-api");

  if (apiPanelOpen) {
    panel.style.display = "flex";

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "api-backdrop";
    backdrop.id = "api-backdrop";
    backdrop.onclick = toggleApiPanel;
    document.body.appendChild(backdrop);

    btn.classList.add("active");
  } else {
    panel.style.display = "none";
    const backdrop = document.getElementById("api-backdrop");
    if (backdrop) backdrop.remove();
    btn.classList.remove("active");

    // Stop any open stream
    if (streamEventSource) {
      streamEventSource.close();
      streamEventSource = null;
    }
  }
}

function switchApiTab(name) {
  // Update tab buttons
  document.querySelectorAll(".api-tab").forEach(t => t.classList.remove("active"));
  event.currentTarget.classList.add("active");

  // Update content panes
  document.querySelectorAll(".api-tab-content").forEach(c => c.classList.remove("active"));
  document.getElementById(`tab-${name}`).classList.add("active");
}

// ── Test Endpoints ───────────────────────────────────────────────────────────
async function testEndpoint(name) {
  const el = document.getElementById(`response-${name}`);
  el.textContent = "Loading…";

  try {
    let res;
    if (name === "run") {
      el.textContent = "Sending POST /api/run …";
      res = await fetch("/api/run", { method: "POST" });
    } else {
      res = await fetch(`/api/${name}`);
    }

    const data = await res.json();

    // For decisions, truncate to first 3 records for readability
    if (name === "decisions" && Array.isArray(data.records) && data.records.length > 3) {
      const preview = {
        records: data.records.slice(0, 3),
        _note: `... ${data.records.length - 3} more records (showing first 3)`
      };
      el.textContent = JSON.stringify(preview, null, 2);
    } else {
      el.textContent = JSON.stringify(data, null, 2);
    }

    // If pipeline was run, refresh the dashboard
    if (name === "run" && data.status === "success") {
      loadAll();
    }

  } catch (err) {
    el.textContent = `Error: ${err.message}`;
  }
}

// ── Live SSE Stream in API panel ─────────────────────────────────────────────
function openStream() {
  const el = document.getElementById("response-stream");

  // Close existing stream if open
  if (streamEventSource) {
    streamEventSource.close();
    streamEventSource = null;
  }

  el.textContent = "";

  streamEventSource = new EventSource("/api/stream");

  streamEventSource.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      el.textContent += d.msg + "\n";
      el.scrollTop = el.scrollHeight;

      if (d.type === "done") {
        streamEventSource.close();
        streamEventSource = null;
        loadAll();  // refresh dashboard after stream ends
      }
    } catch (_) {}
  };

  streamEventSource.onerror = () => {
    if (streamEventSource) {
      streamEventSource.close();
      streamEventSource = null;
    }
    el.textContent += "\n[stream closed]";
  };
}

// ── Copy URL ─────────────────────────────────────────────────────────────────
function copyUrl(path) {
  const url = `${window.location.origin}${path}`;
  navigator.clipboard.writeText(url).then(() => showToast(`Copied: ${url}`));
}

function showToast(msg) {
  let toast = document.getElementById("copy-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "copy-toast";
    toast.className = "copy-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
