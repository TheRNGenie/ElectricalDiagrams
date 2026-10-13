// ULN2003: IN1-IN4 on D8-D11. Send "steps <n>".
#include <Stepper.h>

Stepper motor(2048, 8, 10, 9, 11);   // order is IN1, IN3, IN2, IN4
long pos = 0;

void setup() {
  Serial.begin(115200);
  motor.setSpeed(10);   // rpm
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("steps ")) {
      int n = c.substring(6).toInt();
      motor.step(n);
      pos += n;
    }
  }
  Serial.print("pos=");
  Serial.println(pos);
  delay(200);
}
