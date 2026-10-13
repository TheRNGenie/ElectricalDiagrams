// MPU-6500 on I2C (address 0x68), read directly with Wire
#include <Wire.h>

const uint8_t MPU = 0x68;

int16_t read16() {
  uint8_t hi = Wire.read();
  uint8_t lo = Wire.read();
  return (int16_t)((hi << 8) | lo);
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.beginTransmission(MPU);
  Wire.write(0x6B);   // power management: wake up
  Wire.write(0);
  Wire.endTransmission();
}

void loop() {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);   // first data register
  Wire.endTransmission(false);
  Wire.requestFrom(MPU, (size_t)14);
  float ax = read16() / 16384.0, ay = read16() / 16384.0, az = read16() / 16384.0;
  read16();           // skip temperature
  float gx = read16() / 131.0, gy = read16() / 131.0, gz = read16() / 131.0;
  Serial.print("ax=");  Serial.print(ax, 2);
  Serial.print(",ay="); Serial.print(ay, 2);
  Serial.print(",az="); Serial.print(az, 2);
  Serial.print(",gx="); Serial.print(gx, 1);
  Serial.print(",gy="); Serial.print(gy, 1);
  Serial.print(",gz="); Serial.println(gz, 1);
  delay(100);
}
