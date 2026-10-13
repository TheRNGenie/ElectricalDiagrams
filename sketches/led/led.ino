// LED on D9 through 330 ohm. Send "on" or "off".
const int LED = 9;
bool on = true;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c == "on") on = true;
    if (c == "off") on = false;
  }
  digitalWrite(LED, on ? HIGH : LOW);
  Serial.print("led=");
  Serial.println(on ? 1 : 0);
  delay(200);
}
