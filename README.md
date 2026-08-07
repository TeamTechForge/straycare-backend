# 🐾 StrayCare

StrayCare is a comprehensive platform designed to bridge the gap between compassionate individuals, veterinary professionals, and NGOs to provide better care for stray animals. 

Whether it's reporting an animal in need of rescue, seeking medical help, or coordinating donations, StrayCare provides the necessary tools to make a positive impact on animal welfare.

## 🌟 Key Features

- **Role-Based Profiles:** Tailored experiences for General Users, NGOs, and Vets.
- **Rescue Reporting:** Users can quickly report stray animals in need of medical attention or rescue.
- **Real-Time Communication:** Integrated Socket.IO chat allows seamless communication between users, NGOs, and Vets.
- **Donation Management:** Facilitates donations to verified NGOs to support rescue efforts.
- **Community Forum:** A space for users to discuss, share advice, and build a supportive community.
- **In-App Notifications:** Real-time updates on rescue status, profile verification, and messages.

## 🏗️ Project Structure

The project is divided into a Node.js backend and a React Native mobile application.

### Backend (`straycare-backend`)
- **Tech Stack:** Node.js, Express, TypeScript, MongoDB (Mongoose), Socket.IO.
- **Responsibilities:** Handles API requests, user authentication, role management, real-time web sockets for chat/notifications, and database operations.

### Frontend (`straycare-frontend-mobile`)
- **Tech Stack:** React Native, Expo, TypeScript.
- **Responsibilities:** Delivers a smooth, cross-platform mobile experience for users to interact with the StrayCare ecosystem.

## 🚀 Getting Started

### 1. Backend Setup
Navigate to the backend directory, install dependencies, and start the development server:
```bash
cd straycare-backend
npm install
npm run dev
```
*(Make sure to set up your `.env` file based on `.env.example` before running)*

### 2. Frontend Setup
Navigate to the frontend directory, install dependencies, and start Expo:
```bash
cd straycare-frontend-mobile
npm install
npx expo start
```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Let's work together to make the world a better place for our furry friends.
