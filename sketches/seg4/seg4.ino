// 4-digit common-cathode display: segments on D2-D9 (330 ohm), digits on D10-D13
const int SEG[8] = {2, 3, 4, 5, 6, 7, 8, 9};   // a b c d e f g dp
const int DIG[4] = {10, 11, 12, 13};
const byte DIGITS[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
long value = 1234;
unsigned long lastPrint = 0;

void refresh() {
  long v = value;
  byte pat[4];
  for (int i = 3; i >= 0; i--) { pat[i] = DIGITS[v % 10]; v /= 10; }
  for (int i = 0; i < 4; i++) {
    for (int s = 0; s < 7; s++) {
      if ((pat[i] >> s) & 1) {
        digitalWrite(DIG[i], LOW);
        digitalWrite(SEG[s], HIGH);
        delayMicroseconds(300);
        digitalWrite(SEG[s], LOW);
        digitalWrite(DIG[i], HIGH);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 8; i++) { pinMode(SEG[i], OUTPUT); digitalWrite(SEG[i], LOW); }
  for (int i = 0; i < 4; i++) { pinMode(DIG[i], OUTPUT); digitalWrite(DIG[i], HIGH); }
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("show ")) value = constrain(c.substring(5).toInt(), 0, 9999);
  }
  refresh();
  if (millis() - lastPrint > 500) {
    lastPrint = millis();
    Serial.print("value=");
    Serial.println(value);
  }
}
