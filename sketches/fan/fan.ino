// Fan motor switched by a PN2222 on D3 (via 1k). Send "speed <0-255>".
const int FAN = 3;
int speed = 0;

void setup() {
  Serial.begin(115200);
  pinMode(FAN, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("speed ")) speed = constrain(c.substring(6).toInt(), 0, 255);
  }
  analogWrite(FAN, speed);
  Serial.print("speed=");
  Serial.println(speed);
  delay(200);
}
