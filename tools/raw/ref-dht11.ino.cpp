#include <Arduino.h>
#line 1 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/dht11/dht11.ino"
// DHT11 data on D4
#include <DHT.h>

DHT dht(4, DHT11);

#line 6 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/dht11/dht11.ino"
void setup();
#line 11 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/dht11/dht11.ino"
void loop();
#line 6 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/dht11/dht11.ino"
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

