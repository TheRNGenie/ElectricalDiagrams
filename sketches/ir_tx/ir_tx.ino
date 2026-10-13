// IR emitter on D3. Send "send <command>".
#include <IRremote.hpp>

void setup() {
  Serial.begin(115200);
  IrSender.begin(3);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("send ")) {
      int cmd = c.substring(5).toInt();
      IrSender.sendNEC(0x00, cmd, 0);
      Serial.print("sent=");
      Serial.println(cmd);
    }
  }
}
