// SG90 servo signal on D9. Send "angle <0-180>".
#include <Servo.h>

Servo servo;
int angle = 90;

void setup() {
  Serial.begin(115200);
  servo.attach(9);
  servo.write(angle);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("angle ")) {
      angle = constrain(c.substring(6).toInt(), 0, 180);
      servo.write(angle);
    }
  }
  Serial.print("angle=");
  Serial.println(angle);
  delay(200);
}
