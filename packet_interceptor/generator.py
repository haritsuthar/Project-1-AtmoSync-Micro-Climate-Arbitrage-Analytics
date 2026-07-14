import json
import random
import time
from pathlib import Path

OUT = Path(__file__).with_name("sample_log.jsonl")

def gen():
    return {
        "device_id": 1,
        "function_code": 16,
        "register": 40001,
        "value": round(random.choice([5, 12, 25, 40, 55, 80]), 2),
        "source": "generator"
    }

with OUT.open("w", encoding="utf-8") as f:
    for _ in range(20):
        rec = gen()
        f.write(json.dumps(rec) + "\n")
        time.sleep(0.1)