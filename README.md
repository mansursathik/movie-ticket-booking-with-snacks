# CineReserve: Movie & Snack Booking System

CineReserve is a professional, full-stack movie ticket booking platform built with React, TypeScript, and Firebase. It features a modern user interface, real-time seat selection, integrated snack ordering, and a comprehensive admin dashboard.

## 🚀 Features

- **User Authentication**: Secure Google Login integration.
- **Movie Catalog**: Browse current movies with details, genres, and pricing.
- **Multiple Show Timings**: Each movie now supports multiple fixed timings (11:00 AM, 2:30 PM, 6:30 PM, 10:00 PM) with independent seat tracking.
- **Real-time Seat Selection**: Interactive seat map with visual feedback for available, selected, and booked seats. Separate for each showtime.
- **Dynamic Billing**: Real-time calculation of total costs for tickets and snacks.
- **Booking History**: Users can view their past and upcoming bookings.
- **Admin Dashboard**: 
  - View total revenue and booking analytics.
  - Manage movie listings and snack menu.
  - View all customer bookings.
  - Seed sample data for testing.
- **Responsive Design**: Fully functional on mobile, tablet, and desktop.
- **Error Handling**: Robust error boundaries for database and network issues.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Backend/Database**: Firebase (Firestore, Authentication)
- **Build Tool**: Vite

## 📦 Installation & Setup

1. **Clone the repository** (or download the source).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Firebase**:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
   - Enable Firestore and Google Authentication.
   - Copy your Firebase config into `firebase-applet-config.json`.
4. **Deploy Security Rules**:
   - Copy the contents of `firestore.rules` to the Firebase Console -> Firestore -> Rules tab.
5. **Run the development server**:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `src/App.tsx`: Main application logic, routing, and UI components.
- `src/firebase.ts`: Firebase SDK initialization.
- `src/types.ts`: TypeScript interfaces for data models.
- `firestore.rules`: Security rules for database protection.
- `firebase-blueprint.json`: Database schema definition.

## 🛡️ Security

The application implements strict Firestore Security Rules:
- **Default Deny**: All access is blocked by default.
- **Role-Based Access**: Only admins can modify movies and snacks.
- **Ownership Protection**: Users can only view their own bookings.
- **Data Validation**: All writes are validated for correct types and required fields.

---
Built as a professional-grade project for final year submission.
