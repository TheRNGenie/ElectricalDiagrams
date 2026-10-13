// Joystick: VRx on A0, VRy on A1, SW on D2
const int SW = 2;

void setup() {
  Serial.begin(115200);
  pinMode(SW, INPUT_PULLUP);
}

void loop() {
  Serial.print("x=");   Serial.print(analogRead(A0));
  Serial.print(",y=");  Serial.print(analogRead(A1));
  Serial.print(",sw="); Serial.println(digitalRead(SW) == LOW ? 1 : 0);
  delay(100);
}
