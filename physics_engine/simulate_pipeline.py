import json
import sys
from pathlib import Path

try:
    from OMPython import OMCSessionZMQ
except Exception:
    OMCSessionZMQ = None

def fallback_sim(cmd: float):
    """Pure-Python physics approximation of the pipeline model."""
    pressure = 6.0 + 0.12 * cmd + 0.8 * (1.0 + 0.015 * cmd)
    flow = 1.0 + 0.015 * cmd
    state = "Catastrophic Failure" if pressure > 12.0 or flow > 5.0 else "Safe"
    return {"pressure_bar": round(pressure, 3), "flow_rate": round(flow, 3), "state": state}

def run(cmd: float):
    """Run the pipeline simulation, preferring OpenModelica if available."""
    if OMCSessionZMQ is None:
        return fallback_sim(cmd)

    try:
        omc = OMCSessionZMQ()
        mo_file = str(Path(__file__).with_name("pipeline.mo"))
        omc.sendExpression(f'loadFile("{mo_file.replace(chr(92), "/")}")')
        omc.sendExpression("instantiateModel(Pipeline)")
        res = omc.sendExpression(
            f"simulate(Pipeline, stopTime=1.0, numberOfIntervals=10, cmd={cmd})"
        )
        # Extract results from the Modelica simulation if available
        if isinstance(res, dict) and "pressure_bar" in res and "flow_rate" in res:
            pressure = float(res["pressure_bar"])
            flow = float(res["flow_rate"])
            state = "Catastrophic Failure" if pressure > 12.0 or flow > 5.0 else "Safe"
            return {
                "pressure_bar": round(pressure, 3),
                "flow_rate": round(flow, 3),
                "state": state,
            }
    except Exception:
        pass

    # Fall back to Python physics approximation
    return fallback_sim(cmd)

if __name__ == "__main__":
    cmd = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    print(json.dumps(run(cmd)))