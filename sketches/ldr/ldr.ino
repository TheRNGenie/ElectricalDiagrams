// Photoresistor divider on A1
void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("light=");
  Serial.println(analogRead(A1));
  delay(100);
}
