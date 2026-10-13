// PIR output on D2
const int PIR = 2;

void setup() {
  Serial.begin(115200);
  pinMode(PIR, INPUT);
}

void loop() {
  Serial.print("motion=");
  Serial.println(digitalRead(PIR));
  delay(200);
}
