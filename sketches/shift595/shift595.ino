// 74HC595: data D12, clock D9, latch D11. Send "set <0-255>" or "run".
const int DATA = 12, CLOCK = 9, LATCH = 11;
byte leds = 1;
bool running = true;
unsigned long last = 0;

void write595(byte b) {
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, MSBFIRST, b);
  digitalWrite(LATCH, HIGH);
}

void setup() {
  Serial.begin(115200);
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("set ")) { leds = constrain(c.substring(4).toInt(), 0, 255); running = false; }
    if (c == "run") running = true;
  }
  if (running && millis() - last > 200) {
    last = millis();
    leds = (leds << 1) | (leds >> 7);
    if (leds == 0) leds = 1;
  }
  write595(leds);
  Serial.print("leds=");
  Serial.println(leds);
  delay(50);
}
