// Thermistor divider on A2: 10k from 5V to A2, thermistor from A2 to GND
const float R_FIXED = 10000.0, R_NOMINAL = 10000.0, BETA = 3950.0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int a = analogRead(A2);
  if (a < 1) a = 1;
  if (a > 1022) a = 1022;
  float rt = R_FIXED * a / (1023.0 - a);
  float tc = 1.0 / (1.0 / 298.15 + log(rt / R_NOMINAL) / BETA) - 273.15;
  Serial.print("raw=");     Serial.print(a);
  Serial.print(",temp_c="); Serial.println(tc, 1);
  delay(250);
}
