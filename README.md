# SafeZone 🚨

SafeZone is a **location-based emergency response mobile application** designed to guide users in real time during emergency situations - from receiving an alert, through navigation to the nearest shelter, to emotional support and post-emergency assistance.

The project was developed as part of the **Cloud Computing Workshop**.

---

## 📱 What is SafeZone?

During emergencies, people often receive alerts but lack:
- Clear guidance on *where to go*
- Visibility into *shelter availability*
- Tools to *notify loved ones*
- Support for *stress and anxiety* in real time

SafeZone bridges this gap by providing a **complete emergency assistant**, not just an alert system.

---

## ✨ Key Features

- 📍 **Real-time location-based alerts**
- 🧭 **Navigation to the nearest shelter**
- 🏠 **Shelter occupancy & condition reporting**
- 📩 **Notify emergency contacts with live location**
- 🧠 **AI-powered emotional support (GenAI)**
- ⏱️ **Shelter stay timer (based on Home Front guidelines)**
- 🧾 **Post-emergency recovery tools & checklist**

---

## 🧩 User Flow (High Level)

1. User receives an emergency alert
2. App displays nearby shelters on a map
3. Optimal shelter is selected based on distance
4. Step-by-step navigation guides the user
5. User can:
   - Notify loved ones
   - Report shelter conditions
   - Use emotional support chat
6. After the alert ends - recovery and assistance tools are shown

---

## ☁️ System Architecture

SafeZone is built on a **serverless AWS architecture** to ensure scalability, reliability, and fast response times.

### AWS Services Used

- **AWS Lambda** – Backend business logic (alerts, reports, notifications)
- **Amazon API Gateway** – REST APIs for mobile app communication
- **Amazon DynamoDB** – Main database (users, shelters, reports)
- **AWS Cognito** – User authentication & identity management
- **Amazon S3** – Image uploads (shelter reports)
- **Amazon EventBridge** – Scheduled background tasks
- **Amazon CloudWatch** – Monitoring & logging

---

## 🗺️ Location & Navigation Logic

- GPS access via `expo-location`
- Coordinate conversion (ITM → WGS84) using `proj4`
- Distance calculation using Haversine formula
- Local caching with `AsyncStorage`
- One-tap navigation to Google / Apple Maps

---

## 🛠️ Tech Stack

### Frontend
- React Native
- Expo
- TypeScript

### Backend
- AWS Lambda (Python)
- API Gateway
- DynamoDB

### AI
- OpenAI

---

## 🚀 Installation & Run (Development)

```bash
git clone https://github.com/<your-username>/SafeZone.git
cd SafeZone
npm install
npx expo start
