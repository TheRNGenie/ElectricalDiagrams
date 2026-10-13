// Potentiometer wiper on A0
void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("pot=");
  Serial.println(analogRead(A0));
  delay(100);
}
