// Passive buzzer on D8. Send "tone 440" or "stop".
const int BZ = 8;
int freq = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("tone ")) freq = c.substring(5).toInt();
    if (c == "stop") freq = 0;
    if (freq > 0) tone(BZ, freq); else noTone(BZ);
  }
  Serial.print("freq=");
  Serial.println(freq);
  delay(200);
}
