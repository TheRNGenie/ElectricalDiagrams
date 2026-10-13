// IR receiver signal on D11
#include <IRremote.hpp>

const int IR_PIN = 11;

void setup() {
  Serial.begin(115200);
  IrReceiver.begin(IR_PIN, ENABLE_LED_FEEDBACK);
  Serial.println("Point the remote at the receiver and press a button");
}

void loop() {
  if (IrReceiver.decode()) {
    if (IrReceiver.decodedIRData.protocol != UNKNOWN) {
      Serial.print("ir_cmd=");
      Serial.println(IrReceiver.decodedIRData.command);
    }
    IrReceiver.resume();
  }
}
