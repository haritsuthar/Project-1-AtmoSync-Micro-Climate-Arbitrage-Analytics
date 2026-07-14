within ;
model Pipeline
  parameter Real pressure0 = 6.0;
  parameter Real flow0 = 1.0;
  input Real cmd;
  output Real pressure;
  output Real flow;
equation
  flow = flow0 + 0.015 * cmd;
  pressure = pressure0 + 0.12 * cmd + 0.8 * flow;
end Pipeline;