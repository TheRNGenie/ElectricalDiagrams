// RC522 RFID: SS on D10, RST on D9, SPI on D11-D13, power from 3.3V
#include <SPI.h>
#include <MFRC522.h>

MFRC522 rfid(10, 9);

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Hold a card or fob near the reader");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  uint32_t id = 0;
  for (byte i = 0; i < rfid.uid.size && i < 4; i++) id = (id << 8) | rfid.uid.uidByte[i];
  Serial.print("card=");
  Serial.println(id);
  rfid.PICC_HaltA();
}
