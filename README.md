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

---

<div align="center">

<table style="border-collapse:collapse; border:none;">

  <!-- Row 1: Entry -->
  <tr>
    <td align="center" style="padding:14px;">
      <h4>🔐 Login & Registration</h4>
      <video 
        src="https://github.com/user-attachments/assets/6c837164-6b08-44d1-9360-b1afe638b99b"
        controls
        style="width:420px; max-width:100%; border-radius:12px;">
      </video>
    </td>
    <td align="center" style="padding:14px;">
      <h4>🧭 Shelter Search</h4>
      <video 
        src="https://github.com/user-attachments/assets/79122f22-761c-4f06-aaea-23b75a1b44ed"
        controls
        style="width:420px; max-width:100%; border-radius:12px;">
      </video>
    </td>
  </tr>

  <!-- Row 2: Alert -->
  <tr>
    <td align="center" style="padding:14px;">
      <h4>🚨 Emergency Alert</h4>
      <video 
        src="https://github.com/user-attachments/assets/9163264c-cb58-4e18-8b35-44b2aa2ec2ad"
        controls
        style="width:420px; max-width:100%; border-radius:12px;">
      </video>
    </td>
    <td align="center" style="padding:14px;">
      <h4>⏱️ After Alert Screen</h4>
      <video 
        src="https://github.com/user-attachments/assets/1cc662c8-8afa-4d89-b42f-85b2c03dcf1a"
        controls
        style="width:420px; max-width:100%; border-radius:12px;">
      </video>
    </td>
  </tr>

  <!-- Row 3: Assistance -->
  <tr>
    <td align="center" style="padding:14px;">
      <h4>🆘 Need Help Mode</h4>
      <video 
        src="https://github.com/user-attachments/assets/6c35849b-cd3e-4737-bea5-7c816bbca8f4"
        controls
        style="width:420px; max-width:100%; border-radius:12px;">
      </video>
    </td>
    <td align="center" style="padding:14px;">
      <h4>🏥 Nearby Hospitals</h4>
      <video 
        src="https://github.com/user-attachments/assets/8e83d10d-b046-45f8-9475-e157fcdd9a60"
        controls
        style="width:420px; max-width:100%; border-radius:12px;">
      </video>
    </td>
  </tr>

</table>

</div>

---

## ❤️ Final Note

SafeZone was built not just as a technical project,  
but as a meaningful system designed to protect people when they need it most.
