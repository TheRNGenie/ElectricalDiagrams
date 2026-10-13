// SSD1306 OLED on I2C (0x3C). Send "show <text>".
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
String msg = "Hello";

void setup() {
  Serial.begin(115200);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found at 0x3C");
    while (true) {}
  }
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\n');
    c.trim();
    if (c.startsWith("show ")) msg = c.substring(5);
  }
  int a0 = analogRead(A0);
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2);
  oled.setCursor(0, 0);
  oled.println(msg);
  oled.setTextSize(1);
  oled.setCursor(0, 48);
  oled.print("A0: ");
  oled.println(a0);
  oled.display();
  Serial.print("a0=");
  Serial.println(a0);
  delay(200);
}
