// Tilt switch on D7, other leg to GND
const int TILT = 7;

void setup() {
  Serial.begin(115200);
  pinMode(TILT, INPUT_PULLUP);
}

void loop() {
  Serial.print("tilt=");
  Serial.println(digitalRead(TILT) == LOW ? 1 : 0);
  delay(100);
}
