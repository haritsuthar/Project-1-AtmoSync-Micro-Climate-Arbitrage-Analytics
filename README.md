# VoltGuard — Physics-Aware ICS/SCADA Intrusion Detection System

VoltGuard validates industrial control commands (Modbus-style) against a **physics simulation** of a pipeline system. Commands that would push the physical system into a dangerous state (overpressure, overflow) are **blocked (DROP)**. Safe commands pass through (**ALLOW**). A Qt6 dashboard visualises the decisions.

---

## Architecture

```
packet_interceptor/generator.py
        │  produces sample_log.jsonl (20 synthetic Modbus commands)
        ▼
packet_interceptor/interceptor.py          ← orchestrator
        │  for each command:
        ├─► physics_engine/simulate_pipeline.py <value>
        │         returns { pressure_bar, flow_rate, state }
        ├─► decision_engine  (Rust binary, stdin/stdout)
        │         returns { action, reason }
        └─► output/decisions.jsonl
                        │
                        ▼
              dashboard/  (Qt6 C++)
```

### Physics thresholds
| Parameter     | Safe limit |
|---------------|-----------|
| pressure_bar  | ≤ 12.0    |
| flow_rate     | ≤ 5.0     |

---

## Quick Start (Python-only, no Rust / Qt required)

```bash
# 1. Generate synthetic commands
python VoltGuard/packet_interceptor/generator.py

# 2. Run the full pipeline (physics sim + decision engine)
python VoltGuard/packet_interceptor/interceptor.py
#   → writes VoltGuard/output/decisions.jsonl
```

---

## Full Build (with Rust decision engine)

```bash
cd VoltGuard/decision_engine
cargo build --release
```

The interceptor automatically detects the compiled binary and uses it instead of the Python fallback.

---

## Qt6 Dashboard

```bash
cd VoltGuard/dashboard
cmake -B build -S .
cmake --build build --config Release
./build/VoltGuardDashboard      # Linux/macOS
build\Release\VoltGuardDashboard.exe   # Windows
```

Reads `output/decisions.jsonl` — run the interceptor first.

---

## Component Summary

| Path | Language | Purpose |
|------|----------|---------|
| `packet_interceptor/generator.py` | Python | Generate synthetic Modbus commands |
| `packet_interceptor/interceptor.py` | Python | Pipeline orchestrator |
| `physics_engine/simulate_pipeline.py` | Python | Physics model (fallback) / OpenModelica wrapper |
| `physics_engine/pipeline.mo` | Modelica | High-fidelity pipeline model (optional) |
| `decision_engine/src/main.rs` | Rust | Access-control decision engine |
| `dashboard/` | C++ / Qt6 | Decision visualisation dashboard |
| `shared/models.py` | Python | Shared dataclasses (`Command`, `SimulationResult`) |
