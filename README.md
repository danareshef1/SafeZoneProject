# 🛡️ SafeZone
### Real-Time Emergency Safety & Navigation App

SafeZone is a mobile application designed to help people react quickly, safely, and calmly during emergency situations.

Unlike traditional alert apps, SafeZone doesn’t just notify users - it actively guides them to safety, helps them communicate with loved ones, and provides emotional support when it matters most.

---

## ✨ Key Features

- 📍 **Real-time location-based alerts**
- 🧭 **Step-by-step navigation to the nearest shelter**
- ❤️ **Notify loved ones with live location updates**
- 🤖 **Emotional support powered by Generative AI**
- 🏚️ **Real-time shelter condition reporting**
- 🚑 **Post-emergency recovery tools**
- 🆘 **“Need Help” mode** to alert nearby users and responders

---

## 🏗️ System Architecture

SafeZone is built as a **serverless, cloud-native system** using AWS services.

---

## 🧠 Technologies Used

### 📱 Frontend

| Category | Technology |
|--------|-----------|
| Framework | React Native |
| Platform | Expo |
| Language | TypeScript |
| Location Services | expo-location |
| Local Storage | AsyncStorage |
| Navigation | Google Maps / Apple Maps |

---

### ☁️ Backend (AWS)

| Service | Purpose |
|------|--------|
| AWS Lambda | Serverless backend logic |
| API Gateway | Public REST APIs |
| DynamoDB | Main database (users, shelters, reports) |
| Cognito | Authentication & identity management |
| S3 | Secure image storage (signed URLs) |
| EventBridge | Scheduled background jobs |

---

### 🔌 Third-Party Services

| Service | Usage |
|-------|------|
| Google Maps | Shelter navigation |
| External Alert API | Real-time emergency alerts |
| OpenAI | Emotional support & AI interactions |

---

## 🚀 Why SafeZone?

SafeZone doesn’t replace existing emergency systems - it **completes them**.

It combines:
- Real-time cloud infrastructure
- Mobile-first UX
- Human-centered design

to help users stay safe, informed, and calm under pressure.

---

## 📽️ Demo Videos


<h3>🔐 Login & Registration</h3>
<video controls width="360">
  <source src="https://raw.githubusercontent.com/danareshef1/SafeZoneProject/main/demo/login-and-registration.mp4" type="video/mp4">
</video>

---

<h3>🚨 Emergency Alert</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/emergency-alert.mp4" controls width="320"></video>

---

<h3>⏱️ After Alert Screen</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/after-alert-screen.mp4" controls width="320"></video>

---

<h3>🆘 Need Help Mode</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/need-help.mp4" controls width="320"></video>

---

<h3>🧭 Shelter Search</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/search.mp4" controls width="320"></video>

---

<h3>🗺️ Shelter Navigation</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/shelter-navigation-1.mp4" controls width="320"></video>

---

<h3>📞 Emergency Contacts</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/emergency-contacts.mp4" controls width="320"></video>

---

<h3>🏥 Nearby Hospitals</h3>
<video src="https://github.com/danareshef1/SafeZoneProject/raw/main/demo/nearby-hospitals.mp4" controls width="320"></video>

---

## ❤️ Final Note

SafeZone was built not just as a technical project,  
but as a meaningful system designed to protect people when they need it most.
