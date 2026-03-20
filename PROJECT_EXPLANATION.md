# Project Explanation: CineReserve

## 1. Project Overview
CineReserve is a comprehensive Movie Ticket Booking and Snack Ordering System designed to provide a seamless movie-going experience. It allows users to browse movies, select showtimes, pick seats, order snacks, and view their booking history. The system also includes an admin panel for theater management.

## 2. Key Features & Functionalities
- **User Authentication**: Secure login using Google Auth, ensuring user data is protected.
- **Movie Catalog**: Dynamic movie listings with posters, genres, and pricing.
- **Multiple Show Timings**: Each movie supports multiple fixed timings (11:00 AM, 2:30 PM, 6:30 PM, 10:00 PM).
- **Independent Seat Tracking**: Seat availability is managed separately for each showtime (e.g., booking A1 at 11 AM doesn't affect its availability at 2:30 PM).
- **Real-time Seat Selection**: An interactive seat map that updates in real-time, preventing double bookings.
- **Snack Ordering**: Integrated snack menu with quantity selection and total calculation.
- **Billing System**: A detailed bill summary that combines ticket and snack costs.
- **Admin Dashboard**: A centralized panel for theater owners to monitor revenue, view all bookings, and manage movies/snacks.

## 3. Technical Architecture
- **Frontend**: Built with **React** and **TypeScript** for a robust, type-safe user interface.
- **Styling**: **Tailwind CSS** for a modern, responsive design.
- **Animations**: **Framer Motion** for smooth transitions and interactive elements.
- **Backend**: **Firebase** for real-time database (Firestore) and authentication.
- **Security**: **Firestore Security Rules** to enforce data integrity and user privacy.

## 4. Database Schema (Firestore)
- **`users`**: Stores user profiles (uid, email, role).
- **`movies`**: Stores movie details (title, genre, price, etc.).
- **`showtimes`**: Tracks movie showtimes and booked seats.
- **`snacks`**: Stores snack menu items and pricing.
- **`bookings`**: Records completed transactions (user, movie, seats, snacks, total).

## 5. Security & Validation
- **Authentication**: All sensitive operations require authentication.
- **Role-Based Access Control (RBAC)**: Only admins can add/edit movies and snacks.
- **Ownership**: Users can only access their own booking records.
- **Data Validation**: Security rules validate all data types and required fields before writing to the database.

## 6. Challenges & Solutions
- **Real-time Updates**: Used Firestore's `onSnapshot` to ensure seat availability is always up-to-date.
- **Responsive UI**: Leveraged Tailwind CSS's utility classes to create a mobile-first design.
- **Security**: Implemented complex security rules to prevent unauthorized data modification.

## 7. Future Enhancements
- **Payment Gateway**: Integration with Stripe or PayPal for real payments.
- **QR Code Tickets**: Generating QR codes for easy entry at the theater.
- **Movie Trailers**: Embedding YouTube trailers for each movie.
- **Loyalty Program**: Points system for frequent movie-goers.
