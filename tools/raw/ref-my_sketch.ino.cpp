#include <Arduino.h>
#line 1 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/my_sketch/my_sketch.ino"
// My sketch: edit this file in GitHub, commit, then use "Upload to board" in Board Monitor.
// Prints one line of name=value pairs every 200 ms so Board Monitor can plot it,
// and answers a few text commands sent from the page.
//
// Wiring (change to match your build):
//   A0  potentiometer middle pin
//   A1  photoresistor + 10k resistor divider
//   A2  thermistor + 10k resistor divider

const unsigned long PERIOD_MS = 200;
unsigned long lastSend = 0;
bool streaming = true;
String cmd;

#line 15 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/my_sketch/my_sketch.ino"
void setup();
#line 22 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/my_sketch/my_sketch.ino"
void handleCommand(String c);
#line 33 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/my_sketch/my_sketch.ino"
void loop();
#line 15 "/home/runner/work/ElectricalDiagrams/ElectricalDiagrams/sketches/my_sketch/my_sketch.ino"
void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  while (!Serial && millis() < 3000) {}
  Serial.println("UNO R4 ready. Commands: led on, led off, stop, start, help");
}

void handleCommand(String c) {
  c.trim();
  c.toLowerCase();
  if (c == "led on")       { digitalWrite(LED_BUILTIN, HIGH); Serial.println("ok led on"); }
  else if (c == "led off") { digitalWrite(LED_BUILTIN, LOW);  Serial.println("ok led off"); }
  else if (c == "stop")    { streaming = false; Serial.println("ok stopped"); }
  else if (c == "start")   { streaming = true;  Serial.println("ok started"); }
  else if (c == "help")    { Serial.println("Commands: led on, led off, stop, start, help"); }
  else if (c.length())     { Serial.print("unknown command: "); Serial.println(c); }
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { handleCommand(cmd); cmd = ""; }
    else if (cmd.length() < 64) cmd += ch;
  }

  if (streaming && millis() - lastSend >= PERIOD_MS) {
    lastSend = millis();
    Serial.print("pot=");    Serial.print(analogRead(A0));
    Serial.print(",light="); Serial.print(analogRead(A1));
    Serial.print(",therm="); Serial.println(analogRead(A2));
  }
}

