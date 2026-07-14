from dataclasses import dataclass

@dataclass
class Command:
    device_id: int
    function_code: int
    register: int
    value: float

@dataclass
class SimulationResult:
    pressure_bar: float
    flow_rate: float
    state: str