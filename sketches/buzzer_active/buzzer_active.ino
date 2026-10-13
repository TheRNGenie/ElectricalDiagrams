// Active buzzer on D8. Send "beep".
const int BZ = 8;
unsigned long until = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BZ, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c == "beep") until = millis() + 300;
  }
  bool on = millis() < until;
  digitalWrite(BZ, on ? HIGH : LOW);
  Serial.print("buzz=");
  Serial.println(on ? 1 : 0);
  delay(50);
}
