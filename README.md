# 🏥 Smart Medicine Box

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black?logo=next.js)](https://nextjs.org/)
[![ESP32](https://img.shields.io/badge/ESP32-DevKit-red)](https://www.espressif.com/)

An AI-driven IoT healthcare solution that bridges the gap between medication adherence and remote clinical supervision through real-time monitoring, intelligent reminders, and caregiver connectivity.

![Smart Medicine Box](https://img.shields.io/badge/Status-Active-success)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Team](#-team)
- [Future Enhancements](#-future-enhancements)

---

## 🌟 Overview

Medication non-adherence affects nearly **50% of chronic disease patients** globally, leading to treatment failures and preventable hospitalizations. The Smart Medicine Box addresses this critical healthcare challenge by combining:

- **IoT Hardware**: ESP32-based device with push buttons, LCD display, and buzzer
- **Cloud Infrastructure**: Firebase Realtime Database for secure data synchronization
- **AI Analytics**: Grok-powered intelligent log analysis and conversational insights
- **Web Portal**: Next.js caregiver dashboard for remote monitoring and communication

### Key Statistics

- ✅ **100%** data synchronization accuracy
- ✅ **100%** successful reminder delivery (4-second latency)
- ✅ **7 seconds** average AI response time
- ✅ **99%** system reliability in experimental testing

---

## ✨ Features

### Patient-Side Features

- 🔔 **Automated Medication Reminders**: Visual (LCD) + audio (buzzer) alerts at scheduled times
- ✅ **Medicine Intake Confirmation**: One-button confirmation with timestamp logging
- 🆘 **Emergency Alert System**: Instant emergency notification to caregivers
- 💬 **Real-time Messaging**: Receive messages from caregivers on the device screen
- 📊 **Event Logging**: Automatic cloud logging of all interactions

### Caregiver Features

- 📱 **Multi-Device Dashboard**: Monitor multiple patients from a single interface
- 📈 **Visual Analytics**: Interactive charts showing adherence trends and patterns
- ⏰ **Remote Reminder Scheduling**: Configure medication schedules with custom repeat cycles
- 💬 **Communication**: Send messages directly to patient devices
- 🤖 **AI Assistant**: Automated log summaries and conversational query interface
- 🔐 **Secure Authentication**: Google OAuth with whitelisted access control

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUD LAYER                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Firebase Realtime Database                    │  │
│  │  • /devices    • /events    • /messages              │  │
│  │  • /reminders  • /allowedDoctors                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            ▲                              ▲
            │                              │
   ┌────────┴────────┐          ┌────────┴──────────┐
   │  ESP32 DEVICE   │          │  WEB APPLICATION  │
   ├─────────────────┤          ├───────────────────┤
   │ • 16×2 LCD      │          │ • Next.js 15.5.2  │
   │ • Push Buttons  │          │ • Material-UI v6  │
   │ • Piezo Buzzer  │          │ • Recharts        │
   │ • Wi-Fi Module  │          │ • AI Integration  │
   └─────────────────┘          └───────────────────┘
```

---

## 💻 Tech Stack

### Hardware
- **Microcontroller**: ESP32 DevKit v1
- **Display**: 16×2 LCD with I2C backpack
- **Audio**: Piezo buzzer (2-4 kHz)

### Embedded Software
- **IDE**: Arduino IDE 2.3.6
- **Libraries**: 
  - Firebase ESP32 Client
  - LiquidCrystal I2C
  - WiFi.h
  - time.h (NTP sync)

### Web Application
- **Framework**: Next.js 15.5.2 (React 19.1.0)
- **Styling**: Material-UI v7.3.2, Tailwind CSS 4.1.14
- **Database**: Firebase Realtime Database 12.4.0
- **Charts**: Recharts 3.1.2
- **Carousel**: Swiper 11.2.10

### Cloud & AI
- **Backend**: Firebase (Authentication, Realtime Database)
- **AI Model**: Grok 4.1 Fast (via OpenRouter API)
- **Deployment**: Vercel (Web), Firebase Hosting (Database)

---

## 🚀 Installation

### Prerequisites

- Node.js 20.x or higher
- Arduino IDE 2.x
- Firebase project with Realtime Database enabled
- OpenRouter API key

### 1. Hardware Setup

```bash
# Install Arduino ESP32 board support
# Tools → Board → Boards Manager → Search "esp32" → Install

# Install required libraries via Library Manager:
# - Firebase ESP32 Client by Mobizt
# - LiquidCrystal I2C by Frank de Brabander
```

### 2. Configure Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Realtime Database
3. Set database rules:

```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "events": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "messages": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "reminders": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "allowedDoctors": {
      ".read": "auth != null"
    }
  }
}
```

4. Add authorized caregivers to `/allowedDoctors` path (replace `.` with `,` in email)

### 3. ESP32 Configuration

1. Open Arduino sketch
2. Update Wi-Fi credentials:

```cpp
#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"
```

3. Update Firebase credentials:

```cpp
#define API_KEY "your-firebase-api-key"
#define DATABASE_URL "your-database-url" // e.g., https://project-id.firebaseio.com
```

4. Upload to ESP32

### 4. Web Application Setup

```bash
# Clone repository
git clone https://github.com/yourusername/smart-medicine-box.git
cd smart-medicine-box

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local
```

### 5. Configure Environment Variables

Edit `.env.local`:

```env
OPENROUTER_API_KEY3=your_openrouter_api_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 6. Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Usage

### For Caregivers

1. **Login**: Access `/login` and authenticate with Google
2. **Dashboard**: View all registered devices
3. **Select Patient**: Choose a device to monitor
4. **View Logs**: See complete event history with timestamps
5. **Analyze Data**: View charts and AI-generated summaries
6. **Send Messages**: Communicate directly with the patient
7. **Set Reminders**: Schedule medication alerts with custom repeat cycles

### For Patients

1. **Power On**: Connect the Smart Medicine Box to power
2. **Wait for Connection**: LCD shows "Smart Medicine Box" → Wi-Fi connected
3. **Take Medicine**: Press left button when taking medication
4. **Emergency**: Press right button for urgent caregiver notification
5. **Follow Reminders**: Respond to buzzer alerts and LCD messages

---

## 📁 Project Structure

```
smart-medicine-box/
├── arduino/
│   └── smart_medicine_box.ino      # ESP32 firmware
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai-chat/route.ts    # Conversational AI endpoint
│   │   │   └── ai-summary/route.ts # Log summarization endpoint
│   │   ├── analyse/page.tsx        # Analytics dashboard
│   │   ├── dashboard/page.tsx      # Caregiver dashboard
│   │   ├── login/page.tsx          # Authentication page
│   │   ├── logs/page.tsx           # Event history viewer
│   │   ├── messages/page.tsx       # Messaging interface
│   │   ├── reminders/page.tsx      # Reminder scheduler
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Landing page
│   ├── components/
│   │   └── analyse/
│   │       └── AnalyseChat.tsx     # AI chat component
│   └── lib/
│       ├── firebase.ts             # Firebase configuration
│       └── theme.ts                # Material-UI theme
├── .env.example                     # Environment template
├── firebase.json                    # Firebase config
├── next.config.ts                   # Next.js config
├── package.json                     # Dependencies
└── README.md                        # This file
```

---

## 🔌 API Endpoints

### `/api/ai-summary`

Generates automated adherence summaries from patient logs.

**Request:**
```json
{
  "timeRange": "Week",
  "medicineTaken": 42,
  "emergencies": 3,
  "dailyBreakdown": [...],
  "reminders": [...]
}
```

**Response:**
```json
{
  "summary": "Patient showed 85% adherence this week with 3 emergency alerts..."
}
```

### `/api/ai-chat`

Conversational AI for querying patient data.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "How many doses were missed this week?"}
  ],
  "stats": {...}
}
```

**Response:**
```json
{
  "reply": "Based on the logs, the patient missed 6 doses this week..."
}
```

---

## 🔮 Future Enhancements

### Short-term
- [ ] SMS/Email notifications (Twilio/SendGrid integration)
- [ ] Mobile application (React Native)
- [ ] Battery backup system for power outages

### Long-term
- [ ] Automated pill dispensing mechanism
- [ ] Weight sensors for pill counting
- [ ] Fall detection and activity monitoring

---

## 🙏 Acknowledgments

- **Firebase** for cloud infrastructure and real-time database
- **OpenRouter** for AI model access
- **Material-UI** and **Next.js** communities for excellent documentation

---

<div align="center">

**⭐ Star this repository if you find it helpful!**

</div>
