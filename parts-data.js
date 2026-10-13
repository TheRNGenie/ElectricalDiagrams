// Parts in the ELEGOO UNO R4 WiFi starter kit.
// blocks: the parts drawn on the right of the diagram; pins are "id" or ["id", "label"].
// wires: [from "block.pin", to (board pin, "5V", "GND", or "block.pin"), optional series resistor].
// Every sketch prints name=value lines at 115200 baud so the Monitor tab can plot them.
window.PARTS = [

/* ---------------- Inputs ---------------- */
{ id:'button', name:'Push button', cat:'Inputs',
  what:'Reads 1 while the button is held down. The board’s built-in pull-up resistor keeps the pin HIGH until the button connects it to GND, so no extra resistor is needed.',
  need:['Push button','2 jumper wires'], reads:['button'],
  blocks:[{id:'B',name:'Push button',pins:[['1','leg 1'],['2','leg 2 (diagonal)']]}],
  wires:[['B.1','D2'],['B.2','GND']],
  notes:['Use legs on opposite corners. Legs on the same side may already be connected inside the button.'],
  code:`// Push button on D2, other leg to GND (uses the internal pull-up)
const int BTN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
}

void loop() {
  Serial.print("button=");
  Serial.println(digitalRead(BTN) == LOW ? 1 : 0);
  delay(100);
}` },

{ id:'tilt', name:'Tilt ball switch', cat:'Inputs',
  what:'A ball inside the can connects the two legs when it is upright. Reads 1 when tilted upright, 0 when tipped over.',
  need:['Tilt ball switch','2 jumper wires'], reads:['tilt'],
  blocks:[{id:'S',name:'Tilt switch',pins:[['1','leg 1'],['2','leg 2']]}],
  wires:[['S.1','D7'],['S.2','GND']],
  notes:['The switch has no polarity, either leg can go to D7.'],
  code:`// Tilt switch on D7, other leg to GND
const int TILT = 7;

void setup() {
  Serial.begin(115200);
  pinMode(TILT, INPUT_PULLUP);
}

void loop() {
  Serial.print("tilt=");
  Serial.println(digitalRead(TILT) == LOW ? 1 : 0);
  delay(100);
}` },

{ id:'pot', name:'Potentiometer (10k)', cat:'Inputs',
  what:'A knob that gives a voltage between 0 and 5V. Reads 0 to 1023.',
  need:['10kΩ potentiometer','3 jumper wires'], reads:['pot'],
  blocks:[{id:'P',name:'Potentiometer',pins:[['1','left leg'],['W','middle (wiper)'],['3','right leg']]}],
  wires:[['P.1','5V'],['P.W','A0'],['P.3','GND']],
  notes:['Swap the outer legs if you want the reading to go up when you turn the other way.'],
  code:`// Potentiometer wiper on A0
void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("pot=");
  Serial.println(analogRead(A0));
  delay(100);
}` },

{ id:'joystick', name:'Joystick module', cat:'Inputs',
  what:'Two potentiometers (X and Y, about 512 at rest) plus a push switch when you press the stick down.',
  need:['Joystick module','5 female-to-male wires'], reads:['x','y','sw'],
  blocks:[{id:'J',name:'Joystick module',pins:['GND',['5V','+5V'],'VRx','VRy','SW']}],
  wires:[['J.GND','GND'],['J.5V','5V'],['J.VRx','A0'],['J.VRy','A1'],['J.SW','D2']],
  notes:['SW needs a pull-up, which the sketch turns on inside the board.'],
  code:`// Joystick: VRx on A0, VRy on A1, SW on D2
const int SW = 2;

void setup() {
  Serial.begin(115200);
  pinMode(SW, INPUT_PULLUP);
}

void loop() {
  Serial.print("x=");   Serial.print(analogRead(A0));
  Serial.print(",y=");  Serial.print(analogRead(A1));
  Serial.print(",sw="); Serial.println(digitalRead(SW) == LOW ? 1 : 0);
  delay(100);
}` },

{ id:'keypad', name:'4x4 membrane keypad', cat:'Inputs',
  what:'Sixteen keys wired as 4 rows and 4 columns. The sketch scans them and prints each key you press.',
  need:['4x4 membrane keypad','8 male-to-male wires'], reads:['key (digits only)'], libs:['Keypad by Mark Stanley'],
  blocks:[{id:'K',name:'Keypad (ribbon, left to right)',pins:[['R1','1 row 1'],['R2','2 row 2'],['R3','3 row 3'],['R4','4 row 4'],['C1','5 col 1'],['C2','6 col 2'],['C3','7 col 3'],['C4','8 col 4']]}],
  wires:[['K.R1','D9'],['K.R2','D8'],['K.R3','D7'],['K.R4','D6'],['K.C1','D5'],['K.C2','D4'],['K.C3','D3'],['K.C4','D2']],
  notes:['Hold the keypad face up with the ribbon at the bottom. Ribbon pin 1 is on the left.','Letters and symbols show in the serial output; only digits get plotted.'],
  code:`// 4x4 keypad: rows on D9-D6, columns on D5-D2
#include <Keypad.h>

const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {9, 8, 7, 6};
byte colPins[COLS] = {5, 4, 3, 2};
Keypad pad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

void setup() {
  Serial.begin(115200);
}

void loop() {
  char k = pad.getKey();
  if (k) {
    Serial.print("key=");
    Serial.println(k);
  }
}` },

{ id:'ir-rx', name:'IR receiver + remote', cat:'Inputs',
  what:'Decodes button presses from the kit’s remote. Each button has its own command number.',
  need:['IR receiver module','Remote control','3 female-to-male wires'], reads:['ir_cmd'], libs:['IRremote by shirriff, z3t0, ArminJo (version 4 or newer)'],
  blocks:[{id:'R',name:'IR receiver module',pins:[['S','S / Y signal'],['V','+ / R'],['G','− / G']]}],
  wires:[['R.S','D11'],['R.V','5V'],['R.G','GND']],
  notes:['Point the remote at the dark dome. Each press prints a line like ir_cmd=69.'],
  code:`// IR receiver signal on D11
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
}` },

{ id:'rfid', name:'RC522 RFID reader', cat:'Inputs',
  what:'Reads the ID of the kit’s card and key fob over SPI. Prints a number for each tag it sees.',
  need:['RC522 RFID module','Card or key fob','7 female-to-male wires'], reads:['card'], libs:['MFRC522 by GithubCommunity'], bus:'spi',
  blocks:[{id:'M',name:'RC522 module',pins:[['SDA','SDA (SS)'],'SCK','MOSI','MISO',['IRQ','IRQ (not used)'],'GND','RST',['V33','3.3V']]}],
  wires:[['M.SDA','D10'],['M.SCK','D13'],['M.MOSI','D11'],['M.MISO','D12'],['M.GND','GND'],['M.RST','D9'],['M.V33','3V3']],
  warn:'Power the RC522 from 3.3V only. 5V on its power pin can damage it.',
  notes:['D11, D12 and D13 are the SPI pins on the UNO R4. Other SPI parts can share them but need their own SDA/SS pin.'],
  code:`// RC522 RFID: SS on D10, RST on D9, SPI on D11-D13, power from 3.3V
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
}` },

/* ---------------- Sensors ---------------- */
{ id:'dht11', name:'DHT11 temperature & humidity', cat:'Sensors',
  what:'Measures air temperature (°C) and relative humidity (%). It updates about once every 2 seconds.',
  need:['DHT11 module','3 female-to-male wires'], reads:['temp_c','hum'], libs:['DHT sensor library by Adafruit (also installs Adafruit Unified Sensor)'],
  blocks:[{id:'D',name:'DHT11 module',pins:[['S','S (data)'],['V','+ (middle)'],['G','−']]}],
  wires:[['D.S','D4'],['D.V','5V'],['D.G','GND']],
  notes:['The module already has its pull-up resistor. A bare 4-pin DHT11 would need a 10kΩ resistor from data to 5V.'],
  code:`// DHT11 data on D4
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
}` },

{ id:'ultrasonic', name:'HC-SR04 ultrasonic distance', cat:'Sensors',
  what:'Measures distance to an object from about 2 to 400 cm using sound pulses.',
  need:['HC-SR04 sensor','4 female-to-male wires'], reads:['dist_cm'],
  blocks:[{id:'U',name:'HC-SR04',pins:['VCC','Trig','Echo','GND']}],
  wires:[['U.VCC','5V'],['U.Trig','D12'],['U.Echo','D11'],['U.GND','GND']],
  notes:['Reads 0 when nothing is in range.','Soft or angled surfaces reflect poorly and give jumpy readings.'],
  code:`// HC-SR04: Trig on D12, Echo on D11
const int TRIG = 12, ECHO = 11;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);
  float cm = us / 58.0;
  Serial.print("dist_cm=");
  Serial.println(cm, 1);
  delay(100);
}` },

{ id:'pir', name:'HC-SR501 PIR motion', cat:'Sensors',
  what:'Detects people moving by their body heat. Reads 1 while it sees motion.',
  need:['HC-SR501 PIR module','3 female-to-male wires'], reads:['motion'],
  blocks:[{id:'P',name:'HC-SR501 (dome up)',pins:['VCC','OUT','GND']}],
  wires:[['P.VCC','5V'],['P.OUT','D2'],['P.GND','GND']],
  notes:['Give it about a minute after power-up to settle.','The two orange knobs set sensitivity and how long OUT stays on.'],
  code:`// PIR output on D2
const int PIR = 2;

void setup() {
  Serial.begin(115200);
  pinMode(PIR, INPUT);
}

void loop() {
  Serial.print("motion=");
  Serial.println(digitalRead(PIR));
  delay(200);
}` },

{ id:'ldr', name:'Photoresistor (light)', cat:'Sensors',
  what:'Its resistance drops in bright light. Paired with a 10kΩ resistor it makes a voltage divider, so brighter light gives a higher reading.',
  need:['Photoresistor','10kΩ resistor (brown-black-orange)','3 jumper wires'], reads:['light'],
  blocks:[{id:'L',name:'Photoresistor',pins:[['1','leg 1'],['2','leg 2']]},{id:'R',name:'10kΩ resistor',pins:[['1','end 1'],['2','end 2']]}],
  wires:[['L.1','5V'],['L.2','A1'],['R.1','L.2'],['R.2','GND']],
  notes:['A1 connects where the photoresistor and the 10kΩ resistor meet.'],
  code:`// Photoresistor divider on A1
void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("light=");
  Serial.println(analogRead(A1));
  delay(100);
}` },

{ id:'thermistor', name:'Thermistor (temperature)', cat:'Sensors',
  what:'A 10k NTC thermistor: its resistance drops as it warms. The sketch converts the reading to °C.',
  need:['Thermistor','10kΩ resistor (brown-black-orange)','3 jumper wires'], reads:['raw','temp_c'],
  blocks:[{id:'R',name:'10kΩ resistor',pins:[['1','end 1'],['2','end 2']]},{id:'T',name:'Thermistor',pins:[['1','leg 1'],['2','leg 2']]}],
  wires:[['R.1','5V'],['R.2','A2'],['T.1','R.2'],['T.2','GND']],
  notes:['The conversion assumes a 10k, B=3950 thermistor, which matches the kit part. Expect about ±1 °C.'],
  code:`// Thermistor divider on A2: 10k from 5V to A2, thermistor from A2 to GND
const float R_FIXED = 10000.0, R_NOMINAL = 10000.0, BETA = 3950.0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int a = analogRead(A2);
  if (a < 1) a = 1;
  if (a > 1022) a = 1022;
  float rt = R_FIXED * a / (1023.0 - a);
  float tc = 1.0 / (1.0 / 298.15 + log(rt / R_NOMINAL) / BETA) - 273.15;
  Serial.print("raw=");     Serial.print(a);
  Serial.print(",temp_c="); Serial.println(tc, 1);
  delay(250);
}` },

{ id:'imu', name:'GY-6500 motion sensor (MPU-6500)', cat:'Sensors',
  what:'Accelerometer and gyroscope on I2C. Prints acceleration in g and rotation in degrees per second for X, Y and Z.',
  need:['GY-6500 module','4 female-to-male wires'], reads:['ax','ay','az','gx','gy','gz'], bus:'i2c',
  blocks:[{id:'G',name:'GY-6500',pins:['VCC','GND','SCL','SDA']}],
  wires:[['G.VCC','3V3'],['G.GND','GND'],['G.SCL','SCL'],['G.SDA','SDA']],
  notes:['SDA and SCL are the two pins above AREF on the UNO R4 (also A4 and A5).','Lying flat and still, az reads about 1.00 and the rest near 0. No library needed.'],
  code:`// MPU-6500 on I2C (address 0x68), read directly with Wire
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
}` },

/* ---------------- Lights & sound ---------------- */
{ id:'led', name:'LED', cat:'Lights & sound',
  what:'A single LED. The resistor limits the current so neither the LED nor the pin gets damaged. Send "on" or "off".',
  need:['LED','330Ω resistor (orange-orange-brown)','2 jumper wires'], reads:['led'],
  blocks:[{id:'L',name:'LED',pins:[['A','+ long leg'],['K','− short leg']]}],
  wires:[['L.A','D9','330Ω'],['L.K','GND']],
  notes:['The UNO R4 pins are rated for about 8 mA. 330Ω keeps a red LED near 7 mA; 1kΩ is dimmer and gentler still.'],
  code:`// LED on D9 through 330 ohm. Send "on" or "off".
const int LED = 9;
bool on = true;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c == "on") on = true;
    if (c == "off") on = false;
  }
  digitalWrite(LED, on ? HIGH : LOW);
  Serial.print("led=");
  Serial.println(on ? 1 : 0);
  delay(200);
}` },

{ id:'rgb', name:'RGB LED', cat:'Lights & sound',
  what:'Three LEDs (red, green, blue) in one package with a shared − leg. Mix colours with PWM. Send "rgb 255 80 0".',
  need:['RGB LED (common cathode)','3 × 330Ω resistors','4 jumper wires'], reads:['r','g','b'],
  blocks:[{id:'L',name:'RGB LED (flat side left)',pins:[['R','red'],['K','− longest leg'],['G','green'],['B','blue']]}],
  wires:[['L.R','D6','330Ω'],['L.K','GND'],['L.G','D5','330Ω'],['L.B','D3','330Ω']],
  notes:['The longest leg is the shared −. D3, D5 and D6 can all do PWM.'],
  code:`// RGB LED: red D6, green D5, blue D3, each through 330 ohm
const int R = 6, G = 5, B = 3;
int r = 255, g = 40, b = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("rgb ")) sscanf(c.c_str() + 4, "%d %d %d", &r, &g, &b);
  }
  analogWrite(R, constrain(r, 0, 255));
  analogWrite(G, constrain(g, 0, 255));
  analogWrite(B, constrain(b, 0, 255));
  Serial.print("r=");  Serial.print(r);
  Serial.print(",g="); Serial.print(g);
  Serial.print(",b="); Serial.println(b);
  delay(200);
}` },

{ id:'buzzer-active', name:'Active buzzer', cat:'Lights & sound',
  what:'Beeps at one fixed pitch whenever its pin is HIGH. Send "beep".',
  need:['Active buzzer (sealed bottom, sticker on top)','2 jumper wires'], reads:['buzz'],
  blocks:[{id:'Z',name:'Active buzzer',pins:[['P','+ long leg'],['N','−']]}],
  wires:[['Z.P','D8'],['Z.N','GND']],
  notes:['The active buzzer has a sealed black bottom. The passive one shows a green circuit board underneath.'],
  code:`// Active buzzer on D8. Send "beep".
const int BZ = 8;
unsigned long until = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BZ, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c == "beep") until = millis() + 300;
  }
  bool on = millis() < until;
  digitalWrite(BZ, on ? HIGH : LOW);
  Serial.print("buzz=");
  Serial.println(on ? 1 : 0);
  delay(50);
}` },

{ id:'buzzer-passive', name:'Passive buzzer', cat:'Lights & sound',
  what:'A small speaker that plays whatever frequency you give it. Send "tone 440" or "stop".',
  need:['Passive buzzer (circuit board visible underneath)','2 jumper wires'], reads:['freq'],
  blocks:[{id:'Z',name:'Passive buzzer',pins:[['P','+'],['N','−']]}],
  wires:[['Z.P','D8'],['Z.N','GND']],
  notes:['Try 262 (C), 330 (E) and 392 (G) for a chord.'],
  code:`// Passive buzzer on D8. Send "tone 440" or "stop".
const int BZ = 8;
int freq = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("tone ")) freq = c.substring(5).toInt();
    if (c == "stop") freq = 0;
    if (freq > 0) tone(BZ, freq); else noTone(BZ);
  }
  Serial.print("freq=");
  Serial.println(freq);
  delay(200);
}` },

/* ---------------- Displays ---------------- */
{ id:'oled', name:'0.96" OLED display', cat:'Displays',
  what:'A 128×64 pixel screen on I2C. The sketch shows a message you send and the A0 reading. Send "show hello".',
  need:['0.96" OLED (SSD1306, I2C)','4 female-to-male wires'], reads:['a0'], bus:'i2c',
  libs:['Adafruit SSD1306 (also installs Adafruit GFX)'],
  blocks:[{id:'O',name:'OLED (I2C)',pins:['GND','VCC','SCL','SDA']}],
  wires:[['O.GND','GND'],['O.VCC','5V'],['O.SCL','SCL'],['O.SDA','SDA']],
  notes:['If the screen stays dark, try address 0x3D in the sketch.','It can share SDA/SCL with the GY-6500 because they use different addresses.'],
  code:`// SSD1306 OLED on I2C (0x3C). Send "show <text>".
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
    String c = Serial.readStringUntil('\\n');
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
}` },

{ id:'seg1', name:'1-digit 7-segment display', cat:'Displays',
  what:'Shows one digit. Each segment is an LED with its own resistor; the two middle pins are the shared −. Counts up, or send "show 7".',
  need:['1-digit display (5161AS, common cathode)','8 × 330Ω resistors','9 jumper wires'], reads:['digit'],
  blocks:[{id:'S',name:'5161AS (pin 1 bottom left)',pins:[['a','7 a'],['b','6 b'],['c','4 c'],['d','2 d'],['e','1 e'],['f','9 f'],['g','10 g'],['dp','5 dp'],['COM','3 or 8 COM']]}],
  wires:[['S.a','D2','330Ω'],['S.b','D3','330Ω'],['S.c','D4','330Ω'],['S.d','D5','330Ω'],['S.e','D6','330Ω'],['S.f','D7','330Ω'],['S.g','D8','330Ω'],['S.dp','D9','330Ω'],['S.COM','GND']],
  notes:['Pins are numbered 1–5 along the bottom from the left (decimal point at the bottom right), then 6–10 along the top from the right.'],
  code:`// 1-digit common-cathode display: segments a-g, dp on D2-D9 (330 ohm each)
const int SEG[8] = {2, 3, 4, 5, 6, 7, 8, 9};   // a b c d e f g dp
const byte DIGITS[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
int n = 0;
bool counting = true;
unsigned long last = 0;

void show(int d) {
  for (int i = 0; i < 7; i++) digitalWrite(SEG[i], (DIGITS[d] >> i) & 1);
  digitalWrite(SEG[7], LOW);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 8; i++) pinMode(SEG[i], OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("show ")) { n = constrain(c.substring(5).toInt(), 0, 9); counting = false; }
    if (c == "count") counting = true;
  }
  if (counting && millis() - last > 1000) { last = millis(); n = (n + 1) % 10; }
  show(n);
  Serial.print("digit=");
  Serial.println(n);
  delay(100);
}` },

{ id:'seg4', name:'4-digit 7-segment display', cat:'Displays',
  what:'Shows a number up to 9999. The sketch lights one segment at a time, very fast, so each pin carries just one LED’s current. Send "show 1234".',
  need:['4-digit display (5461AS, common cathode)','8 × 330Ω resistors','12 jumper wires'], reads:['value'],
  blocks:[{id:'S',name:'5461AS (pin 1 bottom left)',pins:[['a','11 a'],['b','7 b'],['c','4 c'],['d','2 d'],['e','1 e'],['f','10 f'],['g','5 g'],['dp','3 dp'],['D1','12 digit 1'],['D2','9 digit 2'],['D3','8 digit 3'],['D4','6 digit 4']]}],
  wires:[['S.a','D2','330Ω'],['S.b','D3','330Ω'],['S.c','D4','330Ω'],['S.d','D5','330Ω'],['S.e','D6','330Ω'],['S.f','D7','330Ω'],['S.g','D8','330Ω'],['S.dp','D9','330Ω'],['S.D1','D10'],['S.D2','D11'],['S.D3','D12'],['S.D4','D13']],
  notes:['Pins 1–6 run along the bottom from the left, 7–12 along the top from the right.','It looks a little dim because it lights one segment at a time. That keeps every pin under the R4’s 8 mA limit.'],
  code:`// 4-digit common-cathode display: segments on D2-D9 (330 ohm), digits on D10-D13
const int SEG[8] = {2, 3, 4, 5, 6, 7, 8, 9};   // a b c d e f g dp
const int DIG[4] = {10, 11, 12, 13};
const byte DIGITS[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
long value = 1234;
unsigned long lastPrint = 0;

void refresh() {
  long v = value;
  byte pat[4];
  for (int i = 3; i >= 0; i--) { pat[i] = DIGITS[v % 10]; v /= 10; }
  for (int i = 0; i < 4; i++) {
    for (int s = 0; s < 7; s++) {
      if ((pat[i] >> s) & 1) {
        digitalWrite(DIG[i], LOW);
        digitalWrite(SEG[s], HIGH);
        delayMicroseconds(300);
        digitalWrite(SEG[s], LOW);
        digitalWrite(DIG[i], HIGH);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 8; i++) { pinMode(SEG[i], OUTPUT); digitalWrite(SEG[i], LOW); }
  for (int i = 0; i < 4; i++) { pinMode(DIG[i], OUTPUT); digitalWrite(DIG[i], HIGH); }
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("show ")) value = constrain(c.substring(5).toInt(), 0, 9999);
  }
  refresh();
  if (millis() - lastPrint > 500) {
    lastPrint = millis();
    Serial.print("value=");
    Serial.println(value);
  }
}` },

{ id:'595', name:'74HC595 shift register + 8 LEDs', cat:'Displays',
  what:'Drives 8 LEDs from just 3 pins. The sketch runs a light along the row, or send "set 170" to show a pattern (0 to 255).',
  need:['74HC595 chip','8 LEDs','8 × 1kΩ resistors (brown-black-red)','About 20 jumper wires'], reads:['leds'],
  blocks:[
    {id:'U',name:'74HC595 (notch up)',pins:[['Q0','15 Q0'],['Q1','1 Q1'],['Q2','2 Q2'],['Q3','3 Q3'],['Q4','4 Q4'],['Q5','5 Q5'],['Q6','6 Q6'],['Q7','7 Q7'],['DS','14 DS data'],['SH','11 SHCP clock'],['ST','12 STCP latch'],['OE','13 OE'],['MR','10 MR'],['VCC','16 VCC'],['GND','8 GND']]},
    {id:'L',name:'8 LEDs',pins:[['0','LED 0 +'],['1','LED 1 +'],['2','LED 2 +'],['3','LED 3 +'],['4','LED 4 +'],['5','LED 5 +'],['6','LED 6 +'],['7','LED 7 +'],['K','all − legs']]}],
  wires:[['U.Q0','L.0','1kΩ'],['U.Q1','L.1','1kΩ'],['U.Q2','L.2','1kΩ'],['U.Q3','L.3','1kΩ'],['U.Q4','L.4','1kΩ'],['U.Q5','L.5','1kΩ'],['U.Q6','L.6','1kΩ'],['U.Q7','L.7','1kΩ'],
         ['U.DS','D12'],['U.SH','D9'],['U.ST','D11'],['U.OE','GND'],['U.MR','5V'],['U.VCC','5V'],['U.GND','GND'],['L.K','GND']],
  notes:['Pin 1 is left of the notch; pins count down the left side and back up the right.','1kΩ keeps the chip’s total current low with all 8 LEDs on.'],
  code:`// 74HC595: data D12, clock D9, latch D11. Send "set <0-255>" or "run".
const int DATA = 12, CLOCK = 9, LATCH = 11;
byte leds = 1;
bool running = true;
unsigned long last = 0;

void write595(byte b) {
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, MSBFIRST, b);
  digitalWrite(LATCH, HIGH);
}

void setup() {
  Serial.begin(115200);
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("set ")) { leds = constrain(c.substring(4).toInt(), 0, 255); running = false; }
    if (c == "run") running = true;
  }
  if (running && millis() - last > 200) {
    last = millis();
    leds = (leds << 1) | (leds >> 7);
    if (leds == 0) leds = 1;
  }
  write595(leds);
  Serial.print("leds=");
  Serial.println(leds);
  delay(50);
}` },

/* ---------------- Motors & switching ---------------- */
{ id:'servo', name:'SG90 servo', cat:'Motors & switching',
  what:'Turns to an angle between 0° and 180° and holds it. Send "angle 90".',
  need:['SG90 servo','3 male-to-male wires'], reads:['angle'], libs:['Servo (comes with the Arduino IDE)'],
  blocks:[{id:'S',name:'SG90 servo',pins:[['Br','brown (−)'],['Rd','red (+)'],['Or','orange (signal)']]}],
  wires:[['S.Br','GND'],['S.Rd','5V'],['S.Or','D9']],
  notes:['If the board resets when the servo moves, power the red wire from the power supply module instead and keep the grounds connected.'],
  code:`// SG90 servo signal on D9. Send "angle <0-180>".
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
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("angle ")) {
      angle = constrain(c.substring(6).toInt(), 0, 180);
      servo.write(angle);
    }
  }
  Serial.print("angle=");
  Serial.println(angle);
  delay(200);
}` },

{ id:'stepper', name:'Stepper motor + ULN2003 driver', cat:'Motors & switching',
  what:'The 28BYJ-48 moves in precise steps: 2048 steps is one full turn. Send "steps 512" for a quarter turn, or a negative number to go back.',
  need:['28BYJ-48 stepper','ULN2003 driver board','6 female-to-male wires'], reads:['pos'], libs:['Stepper (comes with the Arduino IDE)'],
  blocks:[{id:'U',name:'ULN2003 board',pins:['IN1','IN2','IN3','IN4',['P','+ (5V)'],['N','−']]}],
  wires:[['U.IN1','D8'],['U.IN2','D9'],['U.IN3','D10'],['U.IN4','D11'],['U.P','5V'],['U.N','GND']],
  notes:['Plug the motor’s white connector into the socket on the driver board.','The motor draws up to about 250 mA. For long runs, feed + from the power supply module and keep the grounds connected.'],
  code:`// ULN2003: IN1-IN4 on D8-D11. Send "steps <n>".
#include <Stepper.h>

Stepper motor(2048, 8, 10, 9, 11);   // order is IN1, IN3, IN2, IN4
long pos = 0;

void setup() {
  Serial.begin(115200);
  motor.setSpeed(10);   // rpm
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
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
}` },

{ id:'relay', name:'5V relay module', cat:'Motors & switching',
  what:'A switch the board can flip to turn a separate circuit on and off. Send "on" or "off"; you will hear it click.',
  need:['5V relay module','3 female-to-male wires'], reads:['relay'],
  blocks:[{id:'K',name:'Relay module',pins:[['S','S (signal)'],['P','+'],['N','−']]}],
  wires:[['K.S','D7'],['K.P','5V'],['K.N','GND']],
  warn:'Only switch low-voltage things (batteries, the fan, LEDs) on a breadboard. Never wire mains power to it.',
  notes:['The load connects to the screw terminals: COM plus NO (on when active) or NC (on when idle).'],
  code:`// Relay module signal on D7. Send "on" or "off".
const int RELAY = 7;
bool on = false;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c == "on") on = true;
    if (c == "off") on = false;
  }
  digitalWrite(RELAY, on ? HIGH : LOW);
  Serial.print("relay=");
  Serial.println(on ? 1 : 0);
  delay(200);
}` },

{ id:'fan', name:'Fan motor (with transistor)', cat:'Motors & switching',
  what:'The DC motor needs far more current than a pin can give, so the PN2222 transistor switches it and the pin only drives the transistor. The diode soaks up the voltage spike when the motor stops. Send "speed 180" (0 to 255).',
  need:['3-6V motor + fan blade','PN2222 transistor','1N4007 diode','1kΩ resistor','Jumper wires'], reads:['speed'],
  blocks:[{id:'M',name:'DC motor',pins:[['P','+ lead'],['N','− lead']]},{id:'D',name:'1N4007 diode',pins:[['A','anode'],['K','cathode (band)']]},{id:'Q',name:'PN2222 (flat side facing you)',pins:[['E','E left'],['B','B middle'],['C','C right']]}],
  wires:[['M.P','5V'],['M.N','Q.C'],['D.A','M.N'],['D.K','5V'],['Q.B','D3','1kΩ'],['Q.E','GND']],
  notes:['Never connect the motor straight to a pin.','The diode’s band side goes to 5V. Backwards, it shorts the supply.','For full speed or long runs, power the motor’s + from the power supply module and connect its GND to the board’s GND.'],
  code:`// Fan motor switched by a PN2222 on D3 (via 1k). Send "speed <0-255>".
const int FAN = 3;
int speed = 0;

void setup() {
  Serial.begin(115200);
  pinMode(FAN, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("speed ")) speed = constrain(c.substring(6).toInt(), 0, 255);
  }
  analogWrite(FAN, speed);
  Serial.print("speed=");
  Serial.println(speed);
  delay(200);
}` },

{ id:'l293d', name:'L293D motor driver', cat:'Motors & switching',
  what:'Runs the DC motor forwards or backwards at any speed. Send "speed 200", "speed -200" or "speed 0".',
  need:['L293D chip','3-6V motor','About 10 jumper wires'], reads:['speed'],
  blocks:[{id:'U',name:'L293D (notch up)',pins:[['EN','1 EN1,2'],['IN1','2 IN1'],['O1','3 OUT1'],['G','4 and 5 GND'],['O2','6 OUT2'],['IN2','7 IN2'],['V2','8 VCC2 motor'],['V1','16 VCC1 logic']]},{id:'M',name:'DC motor',pins:[['A','lead A'],['B','lead B']]}],
  wires:[['U.EN','D5'],['U.IN1','D4'],['U.IN2','D3'],['U.O1','M.A'],['U.O2','M.B'],['U.G','GND'],['U.V2','5V'],['U.V1','5V']],
  notes:['Pins 4, 5, 12 and 13 are all GND and help cool the chip; connect at least 4 and 5.','The chip has its own protection diodes, so no extra diode is needed.','For a stronger motor, feed pin 8 from the power supply module (keep the grounds connected).'],
  code:`// L293D: EN on D5 (PWM), IN1 on D4, IN2 on D3. Send "speed <-255..255>".
const int EN = 5, IN1 = 4, IN2 = 3;
int speed = 0;

void setup() {
  Serial.begin(115200);
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("speed ")) speed = constrain(c.substring(6).toInt(), -255, 255);
  }
  digitalWrite(IN1, speed > 0 ? HIGH : LOW);
  digitalWrite(IN2, speed < 0 ? HIGH : LOW);
  analogWrite(EN, abs(speed));
  Serial.print("speed=");
  Serial.println(speed);
  delay(200);
}` },

{ id:'ir-tx', name:'IR emitter', cat:'Motors & switching',
  what:'Sends remote-control codes like a TV remote. Send "send 69" to transmit NEC command 69; an IR receiver on a second board will print it.',
  need:['IR emission module','3 female-to-male wires'], reads:['sent'], libs:['IRremote by shirriff, z3t0, ArminJo (version 4 or newer)'],
  blocks:[{id:'T',name:'IR emitter module',pins:[['S','S (signal)'],['V','+'],['G','−']]}],
  wires:[['T.S','D3'],['T.V','5V'],['T.G','GND']],
  notes:['The infrared light is invisible to you but shows up as a purple glow through a phone camera.'],
  code:`// IR emitter on D3. Send "send <command>".
#include <IRremote.hpp>

void setup() {
  Serial.begin(115200);
  IrSender.begin(3);
}

void loop() {
  if (Serial.available()) {
    String c = Serial.readStringUntil('\\n');
    c.trim();
    if (c.startsWith("send ")) {
      int cmd = c.substring(5).toInt();
      IrSender.sendNEC(0x00, cmd, 0);
      Serial.print("sent=");
      Serial.println(cmd);
    }
  }
}` },

/* ---------------- Power ---------------- */
{ id:'psu', name:'Power supply module + 9V battery', cat:'Power', psu:true,
  what:'Clips onto the breadboard and turns the 9V battery into a 5V rail for motors and servos, so they don’t pull power from the board.',
  need:['Power supply module','9V battery and snap-on clip with barrel plug'], reads:[],
  blocks:[{id:'B',name:'9V battery clip',pins:[['plug','barrel plug']]},{id:'P',name:'Power module',pins:[['IN','DC jack in'],['V5','5V out'],['G','GND']]}],
  wires:[['B.plug','P.IN'],['P.V5','5V'],['P.G','GND']],
  warn:'Do not also connect this 5V rail to the board’s 5V pin. Connect only the grounds together.',
  notes:['Set both yellow jumpers on the module to 5V, not 3.3V.','Line the module’s + and − pins up with the breadboard’s red and blue rails.'],
  code:'' },

/* ---------------- Basics ---------------- */
{ id:'basics', name:'Resistors, diodes & transistors', cat:'Basics',
  what:'How to pick out the helper parts used in the diagrams.', reads:[], info:true }
];
