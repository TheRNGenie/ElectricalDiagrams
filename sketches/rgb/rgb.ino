// RGB LED: red D6, green D5, blue D3, each through 330 ohm
const int R = 6, G = 5, B = 3;
int r = 255, g = 40, b = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("rgb ")) sscanf(c.c_str() + 4, "%d %d %d", &r, &g, &b);
  }
  analogWrite(R, constrain(r, 0, 255));
  analogWrite(G, constrain(g, 0, 255));
  analogWrite(B, constrain(b, 0, 255));
  Serial.print("r=");  Serial.print(r);
  Serial.print(",g="); Serial.print(g);
  Serial.print(",b="); Serial.println(b);
  delay(200);
}
