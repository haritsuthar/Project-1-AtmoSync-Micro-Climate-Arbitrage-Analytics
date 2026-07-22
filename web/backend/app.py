"""
VoltGuard Web Backend  —  FastAPI
Endpoints:
  GET  /api/decisions          - all decisions from output/decisions.jsonl
  GET  /api/stats              - summary counts (allow/drop/total)
  POST /api/run                - run generator + interceptor pipeline
  GET  /api/stream             - SSE stream of live pipeline output
  GET  /                       - serves the frontend
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parents[2]          # project root
INTERCEPTOR = ROOT / "packet_interceptor" / "interceptor.py"
GENERATOR   = ROOT / "packet_interceptor" / "generator.py"
DECISIONS   = ROOT / "output" / "decisions.jsonl"
FRONTEND    = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(title="VoltGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend files
app.mount("/static", StaticFiles(directory=str(FRONTEND / "static")), name="static")


# ── Frontend ──────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def index():
    html_file = FRONTEND / "index.html"
    return HTMLResponse(content=html_file.read_text(encoding="utf-8"))


# ── API ───────────────────────────────────────────────────────────────────────
@app.get("/api/decisions")
async def get_decisions():
    """Return all decision records from decisions.jsonl."""
    if not DECISIONS.exists() or DECISIONS.stat().st_size == 0:
        return JSONResponse({"records": [], "message": "No decisions yet. Run the pipeline first."})

    records = []
    with DECISIONS.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return {"records": records}


@app.get("/api/stats")
async def get_stats():
    """Return summary statistics."""
    if not DECISIONS.exists() or DECISIONS.stat().st_size == 0:
        return {"total": 0, "allow": 0, "drop": 0, "allow_pct": 0, "drop_pct": 0}

    total = allow = drop = 0
    with DECISIONS.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                total += 1
                if rec.get("action") == "ALLOW":
                    allow += 1
                else:
                    drop += 1
            except json.JSONDecodeError:
                pass

    return {
        "total": total,
        "allow": allow,
        "drop": drop,
        "allow_pct": round(allow / total * 100, 1) if total else 0,
        "drop_pct":  round(drop  / total * 100, 1) if total else 0,
    }


@app.post("/api/run")
async def run_pipeline():
    """Regenerate data and run the full detection pipeline."""
    try:
        # Step 1: generate new commands
        subprocess.check_call([sys.executable, str(GENERATOR)], timeout=30)
        # Step 2: run interceptor
        subprocess.check_call([sys.executable, str(INTERCEPTOR)], timeout=60)
        return {"status": "success", "message": "Pipeline completed successfully."}
    except subprocess.CalledProcessError as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
    except subprocess.TimeoutExpired:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Pipeline timed out."})


@app.get("/api/stream")
async def stream_pipeline():
    """SSE endpoint — streams live output from running the pipeline."""

    def generate() -> Iterator[str]:
        yield "data: {\"msg\": \"Starting pipeline...\", \"type\": \"info\"}\n\n"

        # Run generator
        yield "data: {\"msg\": \"[1/2] Generating Modbus commands...\", \"type\": \"info\"}\n\n"
        subprocess.run([sys.executable, str(GENERATOR)], timeout=30)
        yield "data: {\"msg\": \"[1/2] sample_log.jsonl created.\", \"type\": \"info\"}\n\n"

        # Stream interceptor output line by line
        yield "data: {\"msg\": \"[2/2] Running detection pipeline...\", \"type\": \"info\"}\n\n"
        proc = subprocess.Popen(
            [sys.executable, str(INTERCEPTOR)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            payload = json.dumps({"msg": line, "type": "drop" if "DROP" in line else "allow" if "ALLOW" in line else "info"})
            yield f"data: {payload}\n\n"

        proc.wait()
        yield "data: {\"msg\": \"Pipeline complete!\", \"type\": \"done\"}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
