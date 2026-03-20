export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  price: number;
  genre: string;
  duration: string;
  category: 'Now Showing' | 'New Releases' | 'Upcoming';
  releaseDate?: string;
  cast?: string;
}

export interface Showtime {
  id: string;
  movieId: string;
  time: string;
  date: string;
  bookedSeats: string[];
}

export interface Snack {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
}

export interface Booking {
  id: string;
  userId: string;
  movieTitle: string;
  showtime: string;
  seats: string[];
  snacks: {
    name: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  timestamp: string;
}

export interface Review {
  id: string;
  movieId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  timestamp: string;
}
