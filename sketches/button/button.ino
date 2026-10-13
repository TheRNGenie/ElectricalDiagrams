// Push button on D2, other leg to GND (uses the internal pull-up)
const int BTN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
}

void loop() {
  Serial.print("button=");
  Serial.println(digitalRead(BTN) == LOW ? 1 : 0);
  delay(100);
}
