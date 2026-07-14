use serde::{Deserialize, Serialize};
use std::io::{self, Read};

#[derive(Deserialize)]
struct SimInput {
    pressure_bar: f64,
    flow_rate: f64,
    state: String,
}

#[derive(Serialize)]
struct Decision {
    action: String,
    reason: String,
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap_or(0);

    let sim: SimInput = serde_json::from_str(&input).unwrap_or(SimInput {
        pressure_bar: 0.0,
        flow_rate: 0.0,
        state: "Safe".to_string(),
    });

    let blocked = sim.state == "Catastrophic Failure" || sim.pressure_bar > 12.0 || sim.flow_rate > 5.0;

    let decision = Decision {
        action: if blocked { "DROP".into() } else { "ALLOW".into() },
        reason: if blocked {
            "Physics threshold exceeded".into()
        } else {
            "Within safe bounds".into()
        },
    };

    println!("{}", serde_json::to_string(&decision).unwrap());
}