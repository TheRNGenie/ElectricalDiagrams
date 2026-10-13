// Relay module signal on D7. Send "on" or "off".
const int RELAY = 7;
bool on = false;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c == "on") on = true;
    if (c == "off") on = false;
  }
  digitalWrite(RELAY, on ? HIGH : LOW);
  Serial.print("relay=");
  Serial.println(on ? 1 : 0);
  delay(200);
}
