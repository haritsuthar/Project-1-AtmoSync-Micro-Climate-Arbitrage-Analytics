# ⚡ VoltGuard — Physics-Aware ICS/SCADA Intrusion Detection System

VoltGuard validates industrial control commands (Modbus-style) against a **physics simulation** of a pipeline system. Commands that would push the physical system into a dangerous state — overpressure or overflow — are **blocked (DROP)**. Safe commands pass through (**ALLOW**). All decisions are logged and visualised in a live web dashboard.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Web Dashboard](#web-dashboard)
- [API Reference](#api-reference)
- [Optional: Rust Decision Engine](#optional-rust-decision-engine)
- [Optional: Qt6 Desktop Dashboard](#optional-qt6-desktop-dashboard)
- [Physics Model](#physics-model)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)

---

## How It Works

1. **Generator** creates 20 synthetic Modbus register-write commands with random valve positions.
2. **Physics engine** simulates what each command does to the pipeline — computing pressure and flow rate.
3. **Decision engine** applies safety thresholds: if pressure exceeds 12 bar or flow exceeds 5 units, the command is `DROP`ped.
4. All decisions are written to `output/decisions.jsonl`.
5. The **web dashboard** visualises every decision with charts, a filterable table, and a live terminal.

---

## Architecture

```
packet_interceptor/generator.py
        │  produces sample_log.jsonl  (20 synthetic Modbus commands)
        ▼
packet_interceptor/interceptor.py          ← pipeline orchestrator
        │
        ├─► physics_engine/simulate_pipeline.py  <cmd_value>
        │         returns { pressure_bar, flow_rate, state }
        │
        ├─► decision_engine binary  (Rust, stdin → stdout)
        │   └─ Python fallback if binary not built
        │         returns { action: ALLOW|DROP, reason }
        │
        └─► output/decisions.jsonl
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
     web/backend/app.py      dashboard/ (Qt6 C++)
     FastAPI REST + SSE      Desktop viewer (optional)
              │
              ▼
     web/frontend/index.html
     Live web dashboard
```

---

## Project Structure

```
📁 Project Root
│
├── packet_interceptor/
│   ├── generator.py          # Generates 20 synthetic Modbus commands → sample_log.jsonl
│   ├── interceptor.py        # Orchestrates the full detection pipeline
│   ├── sample_log.jsonl      # Auto-created; 20 command records
│   └── requirements.txt      # scapy (listed; stdlib used in practice)
│
├── physics_engine/
│   ├── simulate_pipeline.py  # Physics simulation — pure Python fallback + OpenModelica wrapper
│   ├── pipeline.mo           # Modelica pipeline model (optional, high-fidelity)
│   └── requirements.txt      # OMPython (optional)
│
├── decision_engine/
│   ├── src/main.rs           # Rust decision engine — reads JSON stdin, writes ALLOW/DROP stdout
│   └── Cargo.toml            # serde + serde_json dependencies
│
├── web/
│   ├── backend/
│   │   ├── app.py            # FastAPI server — REST API + SSE streaming
│   │   └── requirements.txt  # fastapi==0.115.5, uvicorn==0.32.1
│   └── frontend/
│       ├── index.html        # Single-page dashboard
│       └── static/
│           ├── style.css     # Dark theme styles
│           ├── app.js        # Charts, table, live terminal, API panel
│           └── chart.umd.min.js  # Chart.js v4 (local copy, no CDN needed)
│
├── dashboard/
│   ├── main.cpp              # Qt6 app entry point
│   ├── mainwindow.h/.cpp     # Loads decisions.jsonl into table + log view
│   └── CMakeLists.txt        # Qt6 Widgets build config
│
├── shared/
│   ├── models.py             # Dataclasses: Command, SimulationResult
│   └── __init__.py           # Exports Command, SimulationResult
│
├── output/
│   └── decisions.jsonl       # Pipeline output — auto-created at runtime
│
├── README.md                 # This file
└── RUN_COMMANDS.txt          # Quick command reference
```

---

## Quick Start

**Requirement:** Python 3.8 or newer — check with `python --version`

### 1 — Install web dependencies

```bash
pip install fastapi==0.115.5 uvicorn==0.32.1
```

### 2 — Generate Modbus commands *(optional — interceptor does this automatically)*

```bash
cd packet_interceptor
python generator.py
```

Creates `packet_interceptor/sample_log.jsonl` with 20 records.

### 3 — Run the detection pipeline

```bash
cd packet_interceptor
python interceptor.py
```

Console output:
```
[interceptor] Reading   ...sample_log.jsonl
[interceptor] Writing results to ...decisions.jsonl
[interceptor] Rust decision engine: not found — using Python fallback

🟢 ALLOW | value=  5.0 | pressure=7.460 bar  | flow=1.075 | state=Safe
🟢 ALLOW | value= 25.0 | pressure=10.100 bar | flow=1.375 | state=Safe
🔴 DROP  | value= 40.0 | pressure=12.080 bar | flow=1.600 | state=Catastrophic Failure
🔴 DROP  | value= 80.0 | pressure=17.360 bar | flow=2.200 | state=Catastrophic Failure
...
[interceptor] Done — output/decisions.jsonl
```

### 4 — Start the web server

```bash
cd web/backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 5 — Open the dashboard

```
http://localhost:8000
```

---

## Web Dashboard

The dashboard is a dark-themed single-page app built with vanilla HTML/CSS/JS and Chart.js. No npm or Node.js required.

### Features

| Section | Description |
|---------|-------------|
| **Stats bar** | Total commands processed, allowed count, blocked count with percentages |
| **Donut chart** | ALLOW vs DROP distribution with percentages |
| **Bar + line chart** | Pressure per command (green = safe, red = blocked) with flow rate overlay line |
| **Decision table** | All records — filterable by action (ALLOW/DROP) or free-text search |
| **Live terminal** | Real-time streaming output when pipeline is triggered from the browser |
| **🔌 API panel** | Side panel with live-test buttons for every endpoint and embedded Swagger UI |

### API Panel

Click the **🔌 API** button in the header to open the API panel. It has five tabs:

| Tab | Action |
|-----|--------|
| `GET /api/decisions` | Test button — fetches and displays all records |
| `GET /api/stats` | Test button — fetches summary counts |
| `GET /api/stream` | Open Stream — connects SSE and streams live output |
| `POST /api/run` | Test button — triggers a full pipeline run |
| `📖 API Docs` | Embeds Swagger UI inline; buttons to open in new tab |

Each tab also has a **📋 Copy URL** button that copies the full endpoint URL to clipboard.

---

## API Reference

All endpoints are served at `http://localhost:8000`.

### `GET /`
Serves the web dashboard frontend.

### `GET /api/decisions`
Returns all decision records from the latest pipeline run.

```json
{
  "records": [
    {
      "device_id": 1,
      "function_code": 16,
      "register": 40001,
      "value": 40,
      "source": "generator",
      "pressure_bar": 12.08,
      "flow_rate": 1.6,
      "state": "Catastrophic Failure",
      "action": "DROP",
      "reason": "Physics threshold exceeded"
    }
  ]
}
```

### `GET /api/stats`
Returns summary statistics.

```json
{
  "total": 20,
  "allow": 10,
  "drop": 10,
  "allow_pct": 50.0,
  "drop_pct": 50.0
}
```

### `POST /api/run`
Triggers a full pipeline run (generator → interceptor). Returns when complete.

```json
{ "status": "success", "message": "Pipeline completed successfully." }
```

### `GET /api/stream`
Server-Sent Events (SSE) endpoint. Streams live pipeline output line by line.

Each event is a JSON object:
```json
{ "msg": "🟢 ALLOW | value=  5.0 | pressure=7.460 bar ...", "type": "allow" }
```

`type` values: `info`, `allow`, `drop`, `done`, `error`

### `GET /docs`
Auto-generated interactive Swagger UI — try every endpoint directly in the browser.

### `GET /redoc`
Auto-generated ReDoc API documentation.

---

## Optional: Rust Decision Engine

The decision engine is written in Rust for performance. The interceptor automatically uses it if built; otherwise it falls back to Python with identical logic.

**Install Rust:** https://rustup.rs

```bash
cd decision_engine
cargo build --release
```

Output binary: `decision_engine/target/release/decision_engine.exe` (Windows)

---

## Optional: Qt6 Desktop Dashboard

A native C++ desktop viewer that reads `output/decisions.jsonl` and displays it in a table.

**Requirements:** Qt6 (Widgets), CMake 3.16+, C++17 compiler

```bash
cd dashboard
cmake -B build -S .
cmake --build build --config Release
build\Release\VoltGuardDashboard.exe
```

Run `interceptor.py` first so the output file exists.

---

## Physics Model

The pipeline physics are computed with a pure-Python formula (OpenModelica is used when installed):

```
pressure (bar) = 6.0 + 0.12 × cmd + 0.8 × (1.0 + 0.015 × cmd)
flow rate      = 1.0 + 0.015 × cmd
```

Where `cmd` is the Modbus register value (valve position).

### Safety Thresholds

| Parameter | Safe limit | Result if exceeded |
|-----------|-----------|-------------------|
| `pressure_bar` | ≤ 12.0 bar | `DROP` — Catastrophic Failure |
| `flow_rate` | ≤ 5.0 | `DROP` — Catastrophic Failure |
| Both within limits | — | `ALLOW` — Safe |

---

## Requirements

### Required

| Package | Version | Install |
|---------|---------|---------|
| Python | 3.8+ | https://www.python.org/downloads/ |
| fastapi | 0.115.5 | `pip install fastapi==0.115.5` |
| uvicorn | 0.32.1 | `pip install uvicorn==0.32.1` |

### Optional

| Tool | Purpose | Install |
|------|---------|---------|
| Rust + Cargo | Native decision engine | https://rustup.rs |
| Qt6 + CMake | Desktop dashboard | https://www.qt.io/download |
| OMPython | OpenModelica physics sim | `pip install OMPython` |

---

## Troubleshooting

**`python` is not recognized**
→ Install Python 3 and add it to PATH: https://www.python.org/downloads/

**`ModuleNotFoundError: No module named 'fastapi'`**
→ Run: `pip install fastapi==0.115.5 uvicorn==0.32.1`

**`sample_log.jsonl` is missing**
→ Run `generator.py` first, or just run `interceptor.py` — it auto-generates the file.

**Dashboard shows "No data yet"**
→ Run `interceptor.py` first to produce `output/decisions.jsonl`, then click **▶ Run Pipeline** in the browser or refresh the page.

**Rust binary not found**
→ The pipeline works identically using the Python fallback. Build the Rust binary only if you need the native performance.

**Port 8000 already in use**
→ Use a different port: `python -m uvicorn app:app --port 8001`
