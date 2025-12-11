// ---------- (same includes & creds)
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "time.h"
#include <stdint.h> // added for uint64_t

// -------- WiFi credentials --------
#define WIFI_SSID ""
#define WIFI_PASSWORD ""

// -------- Firebase credentials --------
#define API_KEY ""
#define DATABASE_URL ""

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// -------- LCD setup --------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// -------- Button pins --------
#define BUTTON1 32   // Medicine Taken
#define BUTTON2 33   // Emergency

// -------- Buzzer pin --------
#define BUZZER_PIN 25

// -------- NTP time server --------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;  // +5:30 for IST
const int daylightOffset_sec = 0;

// -------- Device ID --------
String deviceId;

// -------- Globals for doctor message & reminders --------
// Doctor message timeout (1 hour)
const unsigned long DOCTOR_MSG_TIMEOUT = 60UL * 60UL * 1000UL; // 1 hour
// OLD REMINDER_TIMEOUT (kept for compatibility, not used for sticky)
const unsigned long REMINDER_TIMEOUT = 30UL * 60UL * 1000UL; // 30 minutes

// NEW: make reminder sticky for 15 minutes (configurable)
const unsigned long REMINDER_STICKY_MS = 15UL * 60UL * 1000UL; // 15 minutes

String lastShownMsg = "";        // currently shown text (doctor msg or reminder text)
String lastShownMsgId = "";      // id of currently shown (DB key or "REMINDER_<id>")
unsigned long lastShownMsgTime = 0; // millis() when shown

String ackDoctorMsgId = "";      // acknowledged/cleared doctor message id (do not re-show this ID)

// Epoch milliseconds when current reminder was shown (0 = unknown/not set)
uint64_t reminderEpochMs = 0;

// millis() deadline until which reminder must remain on screen (sticky)
unsigned long reminderBlockUntil = 0;

// -------- Reminders data structures --------
#define MAX_REMINDERS 20

struct Reminder {
  String id;
  String medicine;
  int hour;
  int minute;
  bool days[7]; // Sunday=0 .. Saturday=6
  bool enabled;
  String lastTriggeredYMD; // "YYYYMMDD" last date triggered
};

Reminder reminders[MAX_REMINDERS];
int reminderCount = 0;

// Helper: clear reminders array
void clearReminders() {
  for (int i = 0; i < MAX_REMINDERS; i++) {
    reminders[i].id = "";
    reminders[i].medicine = "";
    reminders[i].hour = 0;
    reminders[i].minute = 0;
    for (int d = 0; d < 7; d++) reminders[i].days[d] = false;
    reminders[i].enabled = false;
    reminders[i].lastTriggeredYMD = "";
  }
  reminderCount = 0;
}

// -------- Helper: Smart display for any message --------
void displayMessage(String msg, bool header = false) {
  lcd.clear();

  if (header) {
    lcd.setCursor(0, 0);
    lcd.print("");
    delay(500);
  }

  // Single line
  if (msg.length() <= 16) {
    lcd.setCursor(0, header ? 1 : 0);
    lcd.print(msg);
    return;
  }

  // Two lines (≤32 chars)
  if (msg.length() <= 32) {
    lcd.setCursor(0, header ? 1 : 0);
    lcd.print(msg.substring(0, 16));
    if (!header) {
      lcd.setCursor(0, 1);
      lcd.print(msg.substring(16));
    }
    return;
  }

  // Scrolling for >32 chars (line 2 if header, else full screen)
  if (header) {
    for (int i = 0; i <= msg.length() - 16; i++) {
      lcd.setCursor(0, 1);
      lcd.print(msg.substring(i, i + 16));
      delay(300);
    }
  } else {
    for (int i = 0; i <= msg.length() - 16; i++) {
      lcd.setCursor(0, 0);
      lcd.print(msg.substring(i, i + 16));
      delay(300);
    }
  }
}

// Helper to restore default screen
void restoreDefaultScreen() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Medicine Box");
  lastShownMsg = "";
  lastShownMsgId = "";
  lastShownMsgTime = 0;
  reminderEpochMs = 0;
  reminderBlockUntil = 0;
}

// -------- Time helper --------
String getTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "N/A";
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}

// Return "YYYYMMDD"
String todayYMD() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char b[12];
  strftime(b, sizeof(b), "%Y%m%d", &timeinfo);
  return String(b);
}

// Return current hour and minute
void currentHM(int &h, int &m) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) { h = 0; m = 0; return; }
  h = timeinfo.tm_hour;
  m = timeinfo.tm_min;
}

// Return day of week 0=Sun..6=Sat
int currentWeekday() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return 0;
  return timeinfo.tm_wday;
}

// -------- Log event to Firebase --------
void logEvent(String type) {
  String timestamp = getTime();
  String path = "/events/" + deviceId + "/" + String(millis());

  FirebaseJson json;
  json.set("type", type);
  json.set("timestamp", timestamp);

  if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
    Serial.println("Logged: " + type + " at " + timestamp);
  } else {
    Serial.println("Failed to log event: " + fbdo.errorReason());
  }

  Firebase.RTDB.setString(&fbdo, ("/devices/" + deviceId + "/lastSeen").c_str(), timestamp);
}

// -------- Parse days string ("0,1,2" or "Mon,Wed" etc) into days[] --------
void parseDays(const String &s, bool outDays[7]) {
  for (int i = 0; i < 7; i++) outDays[i] = false;
  if (s.length() == 0) {
    // default = all days
    for (int i = 0; i < 7; i++) outDays[i] = true;
    return;
  }
  // split by comma
  int start = 0;
  while (start < s.length()) {
    int comma = s.indexOf(',', start);
    String token;
    if (comma == -1) {
      token = s.substring(start);
      start = s.length();
    } else {
      token = s.substring(start, comma);
      start = comma + 1;
    }
    token.trim();
    token.toLowerCase();

    if (token.length() == 0) continue;

    // numeric?
    bool isNum = true;
    for (unsigned int k = 0; k < token.length(); k++) if (!isDigit(token[k]) && !(k==0 && token[k]=='-')) isNum = false;
    if (isNum) {
      int n = token.toInt();
      if (n >= 0 && n <= 6) outDays[n] = true;
      continue;
    }

    // name -> map to number
    if (token.startsWith("sun")) outDays[0] = true;
    else if (token.startsWith("mon")) outDays[1] = true;
    else if (token.startsWith("tue")) outDays[2] = true;
    else if (token.startsWith("wed")) outDays[3] = true;
    else if (token.startsWith("thu")) outDays[4] = true;
    else if (token.startsWith("fri")) outDays[5] = true;
    else if (token.startsWith("sat")) outDays[6] = true;
  }
}

// Wait up to `timeoutMs` for NTP time to sync (getLocalTime to succeed)
bool waitForTimeSync(unsigned long timeoutMs = 15000) {
  unsigned long start = millis();
  struct tm timeinfo;
  while (millis() - start < timeoutMs) {
    if (getLocalTime(&timeinfo)) return true;
    delay(200);
  }
  return false;
}

// -------- Fetch reminders from RTDB and populate reminders[] (defensive) --------
void fetchReminders() {
  String path = "/reminders/" + deviceId;
  Serial.println("Fetching reminders from " + path);

  if (!Firebase.RTDB.getJSON(&fbdo, path.c_str())) {
    Serial.println("Failed to get reminders: " + fbdo.errorReason());
    return;
  }

  FirebaseJson &json = fbdo.jsonObject();
  clearReminders();

  // Try parsing as a single reminder object at this path (root has fields)
  FirebaseJsonData tmp;
  if (json.get(tmp, "medicine") || json.get(tmp, "time")) {
    // treat root as a single reminder object
    FirebaseJsonData res;
    String medicine = "";
    String timeStr = "";
    String daysStr = "";
    bool enabled = true;

    if (json.get(res, "medicine") && res.typeNum == FirebaseJson::JSON_STRING) medicine = res.stringValue;
    if (json.get(res, "time")) {
      if (res.typeNum == FirebaseJson::JSON_STRING) timeStr = res.stringValue;
      else if (res.typeNum == FirebaseJson::JSON_INT) timeStr = String(res.intValue);
    }

    if (json.get(res, "days")) {
      if (res.typeNum == FirebaseJson::JSON_STRING) daysStr = res.stringValue;
    }

    if (json.get(res, "enabled")) {
      if (res.typeNum == FirebaseJson::JSON_BOOL) enabled = res.boolValue;
      else if (res.typeNum == FirebaseJson::JSON_INT) enabled = (res.intValue != 0);
    }

    int hh = -1, mm = -1;
    if (timeStr.length() > 0) {
      int colon = timeStr.indexOf(':');
      if (colon > 0) {
        hh = timeStr.substring(0, colon).toInt();
        mm = timeStr.substring(colon + 1).toInt();
      } else {
        int numeric = timeStr.toInt();
        if (numeric >= 0) { hh = numeric / 100; mm = numeric % 100; }
      }
    }

    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 && medicine.length() > 0) {
      reminders[0].id = deviceId + "_root";
      reminders[0].medicine = medicine;
      reminders[0].hour = hh;
      reminders[0].minute = mm;
      parseDays(daysStr, reminders[0].days);
      reminders[0].enabled = enabled;
      reminders[0].lastTriggeredYMD = "";
      reminderCount = 1;
      Serial.printf("Loaded 1 reminder (root): %s at %02d:%02d enabled=%d\n",
                    medicine.c_str(), hh, mm, enabled);
      return;
    }
    // else fallthrough: try to parse child objects
  }

  // Otherwise, parse children (typical structure)
  size_t len = json.iteratorBegin();
  if (len == 0) {
    json.iteratorEnd();
    Serial.println("No reminders found.");
    return;
  }

  for (size_t i = 0; i < len && reminderCount < MAX_REMINDERS; i++) {
    FirebaseJson::IteratorValue it = json.valueAt(i);
    String remId = it.key;
    String raw = it.value; // the JSON text of the child

    // If raw is not an object (e.g., a primitive string or number), skip quietly
    raw.trim();
    if (raw.length() < 3 || raw.charAt(0) != '{') {
      continue;
    }

    FirebaseJson rj;
    rj.setJsonData(raw);
    FirebaseJsonData res;

    String medicine = "";
    String timeStr = "";
    String daysStr = "";
    bool enabled = true;

    if (rj.get(res, "medicine") && res.typeNum == FirebaseJson::JSON_STRING) {
      medicine = res.stringValue; medicine.trim();
    }
    if (rj.get(res, "time")) {
      if (res.typeNum == FirebaseJson::JSON_STRING) timeStr = res.stringValue;
      else if (res.typeNum == FirebaseJson::JSON_INT) timeStr = String(res.intValue);
      timeStr.trim();
    }

    // days (array or string)
    if (rj.get(res, "days")) {
      if (res.typeNum == FirebaseJson::JSON_STRING) {
        daysStr = res.stringValue;
      } else if (res.typeNum == FirebaseJson::JSON_ARRAY) {
        bool first = true;
        for (int a = 0;; a++) {
          FirebaseJsonData tmp2;
          String key = String("days[") + String(a) + String("]");
          if (!rj.get(tmp2, key.c_str())) break;
          String token = "";
          if (tmp2.typeNum == FirebaseJson::JSON_INT) token = String(tmp2.intValue);
          else if (tmp2.typeNum == FirebaseJson::JSON_STRING) token = tmp2.stringValue;
          if (!first) daysStr += ",";
          daysStr += token;
          first = false;
        }
      }
    }

    if (rj.get(res, "enabled")) {
      if (res.typeNum == FirebaseJson::JSON_BOOL) enabled = res.boolValue;
      else if (res.typeNum == FirebaseJson::JSON_INT) enabled = (res.intValue != 0);
      else if (res.typeNum == FirebaseJson::JSON_STRING) enabled = !(String(res.stringValue) == "false");
    }

    // Parse time into hh:mm
    int hh = -1, mm = -1;
    if (timeStr.length() > 0) {
      int colon = timeStr.indexOf(':');
      if (colon > 0) {
        hh = timeStr.substring(0, colon).toInt();
        mm = timeStr.substring(colon + 1).toInt();
      } else {
        int numeric = timeStr.toInt();
        if (numeric >= 0) { hh = numeric / 100; mm = numeric % 100; }
      }
    }

    // Validate
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      Serial.printf("  -> Skipping '%s' (invalid/missing time '%s').\n", remId.c_str(), timeStr.c_str());
      continue;
    }
    if (medicine.length() == 0) {
      Serial.printf("  -> Skipping '%s' (missing medicine name).\n", remId.c_str());
      continue;
    }

    // Store
    reminders[reminderCount].id = remId;
    reminders[reminderCount].medicine = medicine;
    reminders[reminderCount].hour = hh;
    reminders[reminderCount].minute = mm;
    parseDays(daysStr, reminders[reminderCount].days);
    reminders[reminderCount].enabled = enabled;
    reminders[reminderCount].lastTriggeredYMD = "";
    reminderCount++;
  }

  json.iteratorEnd();
  Serial.printf("Loaded %d valid reminders\n", reminderCount);
  for (int i = 0; i < reminderCount; i++) {
    Serial.printf("R[%d] %s at %02d:%02d enabled=%d\n", i,
                  reminders[i].medicine.c_str(),
                  reminders[i].hour, reminders[i].minute,
                  reminders[i].enabled);
  }
}

// -------- Check reminders and trigger if needed --------
void checkReminders() {
  if (reminderCount == 0) return;

  int h, m;
  currentHM(h, m);
  int dow = currentWeekday(); // 0-6

  String ymd = todayYMD();

  for (int i = 0; i < reminderCount; i++) {
    if (!reminders[i].enabled) continue;
    if (!reminders[i].days[dow]) continue;
    if (reminders[i].hour != h || reminders[i].minute != m) continue;

    // check last triggered date to avoid multiple triggers
    if (reminders[i].lastTriggeredYMD == ymd) continue;

    // trigger it
    String msg = "Take:" + reminders[i].medicine;
    displayMessage(msg, false);

    // Buzz pattern for reminders (3 short buzzes)
    for (int k = 0; k < 3; k++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      delay(200);
    }

    // Log an event
    logEvent("Reminder: " + reminders[i].medicine);

    // mark as triggered today
    reminders[i].lastTriggeredYMD = ymd;
    Serial.println("Triggered reminder: " + reminders[i].medicine + " on " + ymd);

    // Make reminder remain on screen for REMINDER_STICKY_MS (15 minutes)
    lastShownMsg = msg;
    lastShownMsgId = "REMINDER_" + reminders[i].id;
    lastShownMsgTime = millis();

    // Record epoch ms when reminder is shown (use current time())
    time_t now_s = time(NULL);
    if (now_s != (time_t)0) {
      reminderEpochMs = (uint64_t)now_s * 1000ULL + (uint64_t)(millis() % 1000);
    } else {
      // if NTP failed, set to 0 to be conservative (unknown)
      reminderEpochMs = 0;
    }

    // set when to stop forcing the reminder on screen
    reminderBlockUntil = millis() + REMINDER_STICKY_MS;
  }
}

// ---------- Helper: parse numeric timestamp string to uint64_t ----------
static uint64_t parseNumericTimestamp(const String &s) {
  uint64_t v = 0;
  for (size_t i = 0; i < s.length(); ++i) {
    char c = s.charAt(i);
    if (c < '0' || c > '9') return 0;
    v = v * 10ULL + (uint64_t)(c - '0');
  }
  return v;
}

// -------- Fetch & display doctor's latest message (64-bit safe, robust parsing) --------
void checkDoctorMessage() {
  String path = "/messages/" + deviceId;

  if (!Firebase.RTDB.getJSON(&fbdo, path.c_str())) {
    Serial.println("Failed to get messages: " + fbdo.errorReason());
    return;
  }

  FirebaseJson &json = fbdo.jsonObject();
  size_t len = json.iteratorBegin();

  if (len == 0) {
    json.iteratorEnd();
    return;
  }

  String latestText = "";
  uint64_t latestMillis = 0;   // store milliseconds (64-bit)
  String latestId = "";

  for (size_t i = 0; i < len; i++) {
    FirebaseJson::IteratorValue value = json.valueAt(i);
    String childKey = value.key;
    String raw = value.value;

    raw.trim();
    if (raw.length() < 3 || raw.charAt(0) != '{') continue; // skip non-object children

    FirebaseJson msgJson;
    msgJson.setJsonData(raw);
    FirebaseJsonData result;

    // Extract text if present
    String text = "";
    if (msgJson.get(result, "text") && result.typeNum == FirebaseJson::JSON_STRING) {
      text = result.stringValue;
      text.trim();
    }

    // Parse timestamp robustly:
    // Try (in order): numeric (as signed 64-bit), numeric (as unsigned), string-of-digits.
    uint64_t msgMillis = 0;
    bool gotTs = false;

    if (msgJson.get(result, "timestamp")) {
      // If library reports JSON_INT types, result.intValue may be signed.
      if (result.typeNum == FirebaseJson::JSON_INT ||
          result.typeNum == FirebaseJson::JSON_DOUBLE ||
          result.typeNum == FirebaseJson::JSON_FLOAT) {
        // Try to interpret as signed 64-bit first
        int64_t s = (int64_t) result.intValue; // defensive cast
        if (s > 0) {
          msgMillis = (uint64_t) s;
          gotTs = true;
        } else {
          // if negative, fallback to parsing as string below
          gotTs = false;
        }
      } else if (result.typeNum == FirebaseJson::JSON_STRING) {
        // timestamp stored as string (maybe serverTimestamp serialized). Parse numeric digits only.
        String tsStr = result.stringValue;
        tsStr.trim();
        // parse digits into uint64_t
        uint64_t v = 0;
        bool ok = false;
        for (size_t k = 0; k < tsStr.length(); ++k) {
          char c = tsStr.charAt(k);
          if (c >= '0' && c <= '9') {
            v = v * 10ULL + (uint64_t)(c - '0');
            ok = true;
          } else {
            // non-digit -> stop parse (we treat as invalid)
            ok = false;
            break;
          }
        }
        if (ok && v > 0) {
          msgMillis = v;
          gotTs = true;
        }
      }
    }

    // If timestamp not found or invalid above, try alternative field "localTimestamp"
    if (!gotTs && msgJson.get(result, "localTimestamp")) {
      if (result.typeNum == FirebaseJson::JSON_INT ||
          result.typeNum == FirebaseJson::JSON_DOUBLE ||
          result.typeNum == FirebaseJson::JSON_FLOAT) {
        int64_t s = (int64_t) result.intValue;
        if (s > 0) {
          msgMillis = (uint64_t) s;
          gotTs = true;
        }
      } else if (result.typeNum == FirebaseJson::JSON_STRING) {
        String tsStr = result.stringValue;
        tsStr.trim();
        uint64_t v = 0;
        bool ok = false;
        for (size_t k = 0; k < tsStr.length(); ++k) {
          char c = tsStr.charAt(k);
          if (c >= '0' && c <= '9') {
            v = v * 10ULL + (uint64_t)(c - '0');
            ok = true;
          } else {
            ok = false;
            break;
          }
        }
        if (ok && v > 0) {
          msgMillis = v;
          gotTs = true;
        }
      }
    }

    // If we still don't have a valid timestamp and we don't yet have ANY candidate message,
    // allow text-only messages as fallback (this preserves original behaviour where an un-timestamped message might be used).
    if (!gotTs) {
      if (latestMillis == 0 && latestText.length() == 0 && text.length() > 0) {
        latestMillis = 0;
        latestText = text;
        latestId = childKey;
      }
      continue;
    }

    // Now compare timestamps (both in ms). Use > to pick newest.
    if (msgMillis > latestMillis) {
      latestMillis = msgMillis;
      latestText = text;
      latestId = childKey;
    }
  }

  json.iteratorEnd();

  // If latest message is acknowledged (user dismissed it earlier), do not re-show
  if (latestId.length() > 0 && latestId == ackDoctorMsgId) {
    // already acknowledged (dismissed) — ignore
    return;
  }

  // Determine if a reminder is actively blocking doctor messages (sticky window)
  bool activeReminder = false;
  if (lastShownMsgId.startsWith("REMINDER_")) {
    // active sticky period if now < reminderBlockUntil
    if (millis() < reminderBlockUntil && reminderEpochMs != 0) {
      activeReminder = true;
    } else {
      // sticky window expired - clear reminder state
      lastShownMsg = "";
      lastShownMsgId = "";
      lastShownMsgTime = 0;
      reminderEpochMs = 0;
      reminderBlockUntil = 0;
      // ensure screen resets (we'll let later code restore default if nothing else)
    }
  }

  bool shouldShow = false;
  if (latestId.length() > 0 && latestText.length() > 0) {
    if (latestId != lastShownMsgId) {
      if (!activeReminder) {
        // no sticky reminder blocking -> show doctor message
        shouldShow = true;
      } else {
        // active sticky reminder - allow override only if doctor's message has a valid epoch ms
        // and it's strictly newer than the reminder's epoch.
        if (latestMillis != 0 && reminderEpochMs != 0 && latestMillis > reminderEpochMs) {
          shouldShow = true; // newer doctor message -> override sticky reminder
        } else {
          shouldShow = false; // don't override a sticky reminder with unknown/older msg
        }
      }
    }
  }

  if (shouldShow) {
    displayMessage(latestText, false);
    Serial.printf("Latest doctor msg: %s (id=%s) ts=%llu\n", latestText.c_str(), latestId.c_str(), (unsigned long long)latestMillis);

    // Buzz 3 times
    for (int i = 0; i < 3; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      delay(200);
    }

    lastShownMsg = latestText;
    lastShownMsgId = latestId;
    lastShownMsgTime = millis();

    // when a doctor message replaces a reminder, clear reminderEpoch/block because it's no longer relevant
    reminderEpochMs = 0;
    reminderBlockUntil = 0;
  }

  // Clear doctor message after DOCTOR_MSG_TIMEOUT
  if (lastShownMsgId.length() > 0 && !lastShownMsgId.startsWith("REMINDER_") &&
      millis() - lastShownMsgTime > DOCTOR_MSG_TIMEOUT) {
    // restore default
    restoreDefaultScreen();
  }

  // Clear reminder if sticky expired (in case no doctor messages arrived)
  if (lastShownMsgId.startsWith("REMINDER_") && (millis() - lastShownMsgTime > REMINDER_STICKY_MS)) {
    restoreDefaultScreen();
  }
}


void setup() {
  Serial.begin(115200);

  lcd.init();
  lcd.backlight();
  displayMessage("Smart Medicine Box");

  pinMode(BUTTON1, INPUT_PULLUP);
  pinMode(BUTTON2, INPUT_PULLUP);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - wifiStart > 20000) {
      Serial.println("\nWiFi connect timeout. Restarting...");
      ESP.restart();
    }
  }
  Serial.println("\nWiFi Connected!");

  // Setup NTP and wait for time
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Waiting for time sync...");
  if (!waitForTimeSync(15000)) {
    Serial.println("Warning: time sync failed or slow — TLS may fail until time is set.");
  } else {
    Serial.println("Time synced: " + getTime());
  }

  // Firebase config
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Try sign-up / sign-in with simple retry/backoff
  int attempts = 0;
  bool signedUp = false;
  while (attempts < 4 && !signedUp) {
    attempts++;
    if (Firebase.signUp(&config, &auth, "", "")) {
      Serial.println("Firebase anonymous sign-in ok");
      signedUp = true;
    } else {
      Serial.printf("Firebase anonymous sign-in failed (attempt %d): %s\n", attempts, config.signer.signupError.message.c_str());
      delay(2000 * attempts);
    }
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  deviceId = WiFi.macAddress();
  Serial.println("Device ID: " + deviceId);

  FirebaseJson deviceInfo;
  deviceInfo.set("name", "Unassigned");
  deviceInfo.set("lastSeen", getTime());

  if (Firebase.RTDB.setJSON(&fbdo, ("/devices/" + deviceId).c_str(), &deviceInfo)) {
    Serial.println("Device registered in Firebase.");
  } else {
    Serial.println("Failed to register device: " + fbdo.errorReason());
  }

  // Initial fetch of reminders
  clearReminders();
  fetchReminders();
}

void loop() {
  // Medicine Taken button
  if (digitalRead(BUTTON1) == LOW) {
    delay(50);
    if (digitalRead(BUTTON1) == LOW) {
      displayMessage("Medicine Taken");
      logEvent("Medicine Taken");

      // Acknowledge (dismiss) any currently shown doctor message (do not re-show same id)
      if (lastShownMsgId.length() > 0 && !lastShownMsgId.startsWith("REMINDER_")) {
        ackDoctorMsgId = lastShownMsgId;
      }
      // clear shown state
      lastShownMsg = "";
      lastShownMsgId = "";
      lastShownMsgTime = 0;

      while (digitalRead(BUTTON1) == LOW);
      delay(200);
    }
  }

  // Emergency button
  if (digitalRead(BUTTON2) == LOW) {
    delay(50);
    if (digitalRead(BUTTON2) == LOW) {
      displayMessage("!!! EMERGENCY !!!");
      logEvent("Emergency");

      // Acknowledge/dismiss any currently shown doctor message
      if (lastShownMsgId.length() > 0 && !lastShownMsgId.startsWith("REMINDER_")) {
        ackDoctorMsgId = lastShownMsgId;
      }
      // clear shown state
      lastShownMsg = "";
      lastShownMsgId = "";
      lastShownMsgTime = 0;

      // stronger alarm for emergencies
      for (int k = 0; k < 20; k++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(200);
        digitalWrite(BUZZER_PIN, LOW);
        delay(200);
      }

      while (digitalRead(BUTTON2) == LOW);
      delay(200);
    }
  }

  // ---------- Periodic activities ----------
  static unsigned long lastCheck = 0;
  static unsigned long lastRemFetch = 0;
  unsigned long now = millis();

  // check messages & reminders every 5 sec
  if (now - lastCheck > 5000) {
    lastCheck = now;
    checkDoctorMessage();
    checkReminders();
  }

  // refetch reminders every 5 minutes
  if (now - lastRemFetch > 5UL * 60UL * 1000UL) {
    lastRemFetch = now;
    fetchReminders();
  }

  // Ensure that if neither a doctor message nor a reminder is active, we show default
  // (This is a safe guard: if screen is blank for some reason, restore default)
  if (lastShownMsgId.length() == 0 && millis() - lastShownMsgTime > 5000) {
    // If nothing shown for >5s, ensure default screen (no frequent writes)
    restoreDefaultScreen();
  }
}
