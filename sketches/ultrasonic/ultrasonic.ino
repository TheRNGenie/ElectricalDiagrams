// HC-SR04: Trig on D12, Echo on D11
const int TRIG = 12, ECHO = 11;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);
  float cm = us / 58.0;
  Serial.print("dist_cm=");
  Serial.println(cm, 1);
  delay(100);
}
