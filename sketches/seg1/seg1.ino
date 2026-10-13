// 1-digit common-cathode display: segments a-g, dp on D2-D9 (330 ohm each)
const int SEG[8] = {2, 3, 4, 5, 6, 7, 8, 9};   // a b c d e f g dp
const byte DIGITS[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
int n = 0;
bool counting = true;
unsigned long last = 0;

void show(int d) {
  for (int i = 0; i < 7; i++) digitalWrite(SEG[i], (DIGITS[d] >> i) & 1);
  digitalWrite(SEG[7], LOW);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 8; i++) pinMode(SEG[i], OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("show ")) { n = constrain(c.substring(5).toInt(), 0, 9); counting = false; }
    if (c == "count") counting = true;
  }
  if (counting && millis() - last > 1000) { last = millis(); n = (n + 1) % 10; }
  show(n);
  Serial.print("digit=");
  Serial.println(n);
  delay(100);
}
