// DHT11 data on D4
#include <DHT.h>

DHT dht(4, DHT11);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  delay(2000);
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 read failed, check wiring");
    return;
  }
  Serial.print("temp_c="); Serial.print(t, 1);
  Serial.print(",hum=");   Serial.println(h, 0);
}
