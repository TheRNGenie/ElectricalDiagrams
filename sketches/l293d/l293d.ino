// L293D: EN on D5 (PWM), IN1 on D4, IN2 on D3. Send "speed <-255..255>".
const int EN = 5, IN1 = 4, IN2 = 3;
int speed = 0;

void setup() {
  Serial.begin(115200);
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("speed ")) speed = constrain(c.substring(6).toInt(), -255, 255);
  }
  digitalWrite(IN1, speed > 0 ? HIGH : LOW);
  digitalWrite(IN2, speed < 0 ? HIGH : LOW);
  analogWrite(EN, abs(speed));
  Serial.print("speed=");
  Serial.println(speed);
  delay(200);
}
