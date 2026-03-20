/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext, ReactNode, FormEvent, ChangeEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Movie, Showtime, Snack, Booking, Review } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, 
  Ticket, 
  Coffee, 
  User as UserIcon, 
  LogIn,
  LogOut, 
  ChevronRight, 
  Check, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Edit,
  LayoutDashboard,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  ShieldAlert,
  Download,
  FileText,
  Loader2,
  Star,
  MessageSquare,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { TicketDisplay } from './components/TicketDisplay';
import { downloadTicketAsPDF, downloadTicketAsTXT } from './utils/ticketGenerator';

// --- Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// --- Components ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

const ErrorBoundary = ({ children }: { children: ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      try {
        const parsed = JSON.parse(event.error?.message);
        if (parsed.error && parsed.operationType) {
          setHasError(true);
          setErrorInfo(parsed);
        }
      } catch (e) {
        // Not a Firestore error
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError && errorInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-xl font-bold">Database Error</h2>
          </div>
          <p className="text-gray-600 mb-6">A database permission error occurred ({errorInfo.operationType} on {errorInfo.path}). This usually means security rules are blocking the request.</p>
          <div className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-40 mb-6 text-gray-500 space-y-2">
            <p><strong>Error:</strong> {errorInfo.error}</p>
            <p><strong>Path:</strong> {errorInfo.path}</p>
            <p><strong>User ID:</strong> {errorInfo.authInfo.userId || 'Not logged in'}</p>
            <p><strong>Email:</strong> {errorInfo.authInfo.email}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return children;
};

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const { user, profile, logout, login } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setActiveTab('movies')}
        >
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Film className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">CineReserve</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => setActiveTab('movies')}
            className={`text-sm font-medium transition-colors ${activeTab === 'movies' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Movies
          </button>
          {user && (
            <button 
              onClick={() => setActiveTab('bookings')}
              className={`text-sm font-medium transition-colors ${activeTab === 'bookings' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              My Bookings
            </button>
          )}
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`text-sm font-medium transition-colors ${activeTab === 'admin' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Admin Panel
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setActiveTab('login')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all shadow-md ${activeTab === 'login' ? 'bg-gray-100 text-gray-900' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movies' | 'bookings' | 'admin' | 'login'>('movies');

  useEffect(() => {
    const seedMovies = async () => {
      const seeded = localStorage.getItem('cine_reserve_seeded_movies_v2');
      if (seeded) return;

      try {
        const sampleMovies = [
          { 
            title: "Made in Korea", 
            genre: "Drama", 
            duration: "2h 15m", 
            price: 150, 
            posterUrl: "https://picsum.photos/seed/korea/400/600", 
            description: "A gripping tale of ambition and survival.", 
            category: "Now Showing",
            cast: "Priyanka Arul Mohan, Rishikanth"
          },
          { 
            title: "Parasakthi", 
            genre: "Action", 
            duration: "2h 30m", 
            price: 150, 
            posterUrl: "https://picsum.photos/seed/parasakthi/400/600", 
            description: "An epic battle for justice and honor.", 
            category: "Now Showing",
            cast: "Sivakarthikeyan, Atharvaa"
          },
          { 
            title: "Thaai Kizhavi", 
            genre: "Family", 
            duration: "2h 10m", 
            price: 120, 
            posterUrl: "https://picsum.photos/seed/thaai/400/600", 
            description: "A heartwarming story of family bonds.", 
            category: "Now Showing",
            cast: "Radhika Sarathkumar, Singampuli"
          },
          { 
            title: "Vikram's Film", 
            genre: "Thriller", 
            duration: "2h 45m", 
            price: 180, 
            posterUrl: "https://picsum.photos/seed/vikram/400/600", 
            description: "A high-stakes mystery that will keep you guessing.", 
            category: "Upcoming",
            releaseDate: "March 27",
            cast: "Vikram, S.J. Suryah"
          },
          { 
            title: "Jailer 2", 
            genre: "Action", 
            duration: "2h 50m", 
            price: 200, 
            posterUrl: "https://picsum.photos/seed/jailer2/400/600", 
            description: "The legend returns for his biggest mission yet.", 
            category: "Upcoming",
            releaseDate: "April 2026",
            cast: "Rajinikanth, S.J. Suryah"
          }
        ];

        const q = query(collection(db, 'movies'));
        const snapshot = await getDocs(q);
        const existingTitles = snapshot.docs.map(doc => doc.data().title.toLowerCase());

        for (const m of sampleMovies) {
          if (existingTitles.includes(m.title.toLowerCase())) continue;

          const movieRef = await addDoc(collection(db, 'movies'), m);
          const fixedTimings = ["11:00 AM", "02:30 PM", "06:30 PM", "10:00 PM"];
          for (const time of fixedTimings) {
            await addDoc(collection(db, 'showtimes'), {
              movieId: movieRef.id,
              date: "2026-03-20",
              time: time,
              bookedSeats: []
            });
          }
        }
        localStorage.setItem('cine_reserve_seeded_movies_v2', 'true');
      } catch (error) {
        console.error("Error auto-seeding movies:", error);
      }
    };
    seedMovies();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          let userProfile: UserProfile;
          if (docSnap.exists()) {
            userProfile = docSnap.data() as UserProfile;
          } else {
            userProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              role: u.email === 'mansurgt13@gmail.com' ? 'admin' : 'user'
            };
            await setDoc(docRef, userProfile);
          }
          setProfile(userProfile);
          
          // Auto-redirect after login
          setActiveTab(prev => {
            if (prev === 'login') {
              return userProfile.role === 'admin' ? 'admin' : 'movies';
            }
            return prev;
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User cancelled the login, no need to show a scary error
        console.log('Login cancelled by user');
        return;
      }
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setActiveTab('movies');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">Loading CineReserve...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 pt-24 pb-12">
          <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <main className="max-w-7xl mx-auto px-6">
            <AnimatePresence mode="wait">
              {activeTab === 'movies' && <MovieCatalog key="movies" />}
              {activeTab === 'bookings' && <BookingHistory key="bookings" />}
              {activeTab === 'admin' && <AdminDashboard key="admin" />}
              {activeTab === 'login' && <LoginPortal key="login" onBack={() => setActiveTab('movies')} />}
            </AnimatePresence>
          </main>
        </div>
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}

// --- Sub-Components ---

const LoginPortal = ({ onBack }: { onBack: () => void, key?: string }) => {
  const { login } = useAuth();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-12"
    >
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-gray-900 tracking-tight">Welcome to CineReserve</h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto">Please select your portal to continue your cinematic journey.</p>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Customer Login */}
        <motion.div 
          whileHover={{ y: -10 }}
          className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-8 hover:shadow-2xl transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
          <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
            <UserIcon className="w-12 h-12" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-gray-900">Customer</h2>
            <p className="text-gray-500 leading-relaxed">Book tickets, order snacks, and manage your movie history with ease.</p>
          </div>
          <button 
            onClick={login}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg flex items-center justify-center gap-3 text-lg"
          >
            <LogIn className="w-6 h-6" />
            Sign In as Customer
          </button>
        </motion.div>

        {/* Admin Login */}
        <motion.div 
          whileHover={{ y: -10 }}
          className="bg-gray-900 p-10 rounded-[3rem] shadow-xl border border-gray-800 flex flex-col items-center text-center space-y-8 hover:shadow-2xl transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />
          <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
            <ShieldCheck className="w-12 h-12" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white">Administrator</h2>
            <p className="text-gray-400 leading-relaxed">Manage movies, track bookings, and oversee theater operations.</p>
          </div>
          <button 
            onClick={login}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-3 text-lg"
          >
            <ShieldCheck className="w-6 h-6" />
            Sign In as Admin
          </button>
          <p className="text-[11px] text-gray-500 uppercase tracking-[0.3em] font-black">Authorized Access Only</p>
        </motion.div>
      </div>

      <button 
        onClick={onBack}
        className="text-gray-400 hover:text-gray-900 font-bold transition-colors flex items-center gap-2"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Movies
      </button>
    </motion.div>
  );
};

const MovieCatalog = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'movies'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMovies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movie)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'movies');
    });
    return unsubscribe;
  }, []);

  if (selectedMovie) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return <BookingFlow movie={selectedMovie} onBack={() => setSelectedMovie(null)} />;
  }

  const categories = [
    { id: 'Now Showing', title: '🎬 Now Showing', description: 'Currently running in theaters' },
    { id: 'New Releases', title: '🆕 New Releases', description: 'Freshly arrived blockbusters' },
    { id: 'Upcoming', title: '🔜 Upcoming Movies', description: 'Coming soon to CineReserve' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-16"
    >
      {categories.map(category => {
        const categoryMovies = movies.filter(m => m.category === category.id);
        if (categoryMovies.length === 0 && category.id !== 'Now Showing') return null;

        return (
          <div key={category.id} className="space-y-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{category.title}</h2>
              <p className="text-gray-500">{category.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {categoryMovies.map((movie) => (
                <motion.div 
                  key={movie.id}
                  whileHover={{ y: -8 }}
                  onClick={() => movie.category !== 'Upcoming' && setSelectedMovie(movie)}
                  className={`group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100 relative ${movie.category !== 'Upcoming' ? 'cursor-pointer' : ''}`}
                >
                  <div className="aspect-[2/3] relative overflow-hidden">
                    <img 
                      src={movie.posterUrl || `https://picsum.photos/seed/${movie.title}/400/600`} 
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <p className="text-white text-sm font-medium line-clamp-3">{movie.description}</p>
                      {movie.category !== 'Upcoming' && (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Available Showtimes</span>
                          <div className="flex flex-wrap justify-center gap-2">
                            {["11:00 AM", "02:30 PM", "06:30 PM", "10:00 PM"].map(t => (
                              <span key={t} className="px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[10px] text-white font-bold">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                      <div className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-xs font-bold rounded-full">
                        {movie.genre}
                      </div>
                      {movie.category === 'Upcoming' && (
                        <div className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                          Coming Soon
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{movie.title}</h3>
                      <p className="text-sm text-gray-500">
                        {movie.category === 'Upcoming' ? `Releasing: ${movie.releaseDate}` : movie.duration}
                      </p>
                      {movie.cast && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                          Cast: {movie.cast}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-indigo-600">₹{movie.price}</span>
                      <button 
                        disabled={movie.category === 'Upcoming'}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!user) {
                            // We can't easily switch tab here without passing setActiveTab
                            // But handleBooking already handles login.
                            // Let's make it consistent: if not logged in, show "Login to Book"
                            setSelectedMovie(movie); 
                          } else {
                            setSelectedMovie(movie); 
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                          movie.category === 'Upcoming' 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-gray-900 text-white hover:bg-indigo-600 shadow-md hover:shadow-indigo-100'
                        }`}
                      >
                        {movie.category === 'Upcoming' ? 'Coming Soon' : (user ? 'View Showtimes' : 'Login to Book')}
                        {movie.category !== 'Upcoming' && <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {categoryMovies.length === 0 && category.id === 'Now Showing' && (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                <Film className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">No movies available</h3>
                <p className="text-gray-500">Check back later for new releases.</p>
              </div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
};

const BookingFlow = ({ movie, onBack }: { movie: Movie, onBack: () => void }) => {
  const [step, setStep] = useState(1);
  const [selectedShowtime, setSelectedShowtime] = useState<Showtime | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedSnacks, setSelectedSnacks] = useState<{ name: string, quantity: number, price: number }[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);
  const [bookingTime, setBookingTime] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { user, profile, login } = useAuth();

  const totalAmount = (selectedSeats.length * movie.price) + 
    selectedSnacks.reduce((acc, s) => acc + (s.price * s.quantity), 0);

  const handleBooking = async () => {
    setIsBooking(true);
    setBookingError('');
    try {
      const now = new Date().toISOString();
      const bookingData = {
        userId: user.uid,
        movieTitle: movie.title,
        showtime: `${selectedShowtime?.date} ${selectedShowtime?.time}`,
        seats: selectedSeats,
        snacks: selectedSnacks,
        totalAmount,
        timestamp: now
      };

      const docRef = await addDoc(collection(db, 'bookings'), bookingData);
      setLastBookingId(docRef.id);
      setBookingTime(now);

      // Update booked seats in showtime
      if (selectedShowtime) {
        const showtimeRef = doc(db, 'showtimes', selectedShowtime.id);
        await updateDoc(showtimeRef, {
          bookedSeats: [...(selectedShowtime.bookedSeats || []), ...selectedSeats]
        });
      }

      setStep(4); // Confirmation step
    } catch (error) {
      console.error("Booking error:", error);
      if (error instanceof Error && error.message.includes('Firestore Error')) {
        throw error; // Let ErrorBoundary handle it
      }
      setBookingError('Failed to complete booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  if (!user) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto py-20 px-6 text-center space-y-8 bg-white rounded-[3rem] shadow-xl border border-gray-100"
      >
        <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto">
          <UserIcon className="w-12 h-12" />
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">Login Required</h2>
          <p className="text-gray-500 text-lg">Please sign in to your account to book tickets and enjoy exclusive member benefits.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button 
            onClick={onBack}
            className="px-8 py-4 bg-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={login}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
          >
            <LogIn className="w-5 h-5" />
            Sign In with Google
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        <X className="w-4 h-4" />
        Cancel Booking
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-24 rounded-lg overflow-hidden shadow-md">
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{movie.title}</h2>
            <p className="text-gray-500">{movie.genre} • {movie.duration}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Step {step} of 3</p>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 w-8 rounded-full ${s <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-10"
          >
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Available Showtimes</h3>
                <p className="text-gray-500">Pick a time that works best for you. All times are in local timezone.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ShowtimePicker movieId={movie.id} onSelect={(s) => { setSelectedShowtime(s); setStep(2); }} />
              </div>
            </div>

            <ReviewSection movieId={movie.id} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                <h4 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Important Information
                </h4>
                <ul className="space-y-3 text-indigo-700 text-sm">
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Please arrive at least 15 minutes before the showtime.
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Digital tickets will be sent to your email and available in 'My Bookings'.
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Outside food and drinks are not permitted inside the theater.
                  </li>
                </ul>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Secure Booking</h4>
                  <p className="text-xs text-gray-500 mt-1">Your transaction is protected with industry-standard encryption.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && selectedShowtime && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Select Seats</h3>
              <div className="flex gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-emerald-500 rounded shadow-sm" /> 
                  <span className="text-emerald-700">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-amber-400 rounded shadow-sm" /> 
                  <span className="text-amber-700">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-rose-500 rounded shadow-sm" /> 
                  <span className="text-rose-700">Booked</span>
                </div>
              </div>
            </div>
            
            <SeatMap 
              bookedSeats={selectedShowtime.bookedSeats || []} 
              selectedSeats={selectedSeats} 
              onToggle={(seat) => {
                setSelectedSeats(prev => prev.includes(seat) ? prev.filter(s => s !== seat) : [...prev, seat]);
              }} 
            />

            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-8 rounded-3xl shadow-lg border border-gray-100 gap-6">
              <div className="flex gap-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Selected Seats ({selectedSeats.length})</p>
                  <p className="font-black text-gray-900 text-lg">{selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}</p>
                </div>
                <div className="pl-8 border-l border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Running Total</p>
                  <p className="font-black text-indigo-600 text-lg">₹{selectedSeats.length * movie.price}</p>
                </div>
              </div>
              <div className="flex gap-4 w-full sm:w-auto">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 sm:flex-none px-8 py-4 bg-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Back
                </button>
                <button 
                  disabled={selectedSeats.length === 0}
                  onClick={() => setStep(3)}
                  className="flex-1 sm:flex-none px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 hover:scale-105 transition-all"
                >
                  Next: Snacks
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <h3 className="text-xl font-bold text-gray-900">Add Snacks</h3>
            <SnackPicker selectedSnacks={selectedSnacks} onChange={setSelectedSnacks} />

            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 space-y-6">
              <h4 className="text-lg font-bold text-gray-900">Order Summary</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Tickets ({selectedSeats.length}x)</span>
                  <span>₹{selectedSeats.length * movie.price}</span>
                </div>
                {selectedSnacks.map(s => (
                  <div key={s.name} className="flex justify-between text-gray-600">
                    <span>{s.name} (x{s.quantity})</span>
                    <span>₹{s.price * s.quantity}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 flex justify-between text-xl font-extrabold text-gray-900">
                  <span>Total</span>
                  <span>₹{totalAmount}</span>
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Back
                </button>
                <button 
                  disabled={isBooking}
                  onClick={handleBooking}
                  className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isBooking ? 'Processing...' : `Confirm & Pay ₹${totalAmount}`}
                </button>
              </div>
              {bookingError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium">
                  <AlertCircle className="w-5 h-5" />
                  {bookingError}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 4 && lastBookingId && bookingTime && selectedShowtime && (
          <motion.div 
            key="step4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-12 space-y-8"
          >
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-gray-900">Booking Confirmed!</h2>
              <p className="text-gray-500 max-w-md mx-auto">Your tickets for {movie.title} have been booked. You can download your ticket below.</p>
            </div>

            <div className="flex flex-col lg:flex-row items-start justify-center gap-12 pt-4">
              {/* Ticket Preview */}
              <div className="flex flex-col items-center space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ticket Preview</p>
                <TicketDisplay 
                  bookingId={lastBookingId}
                  userName={profile?.displayName || user?.email?.split('@')[0] || 'Guest'}
                  movie={movie}
                  showtime={selectedShowtime}
                  seats={selectedSeats}
                  snacks={selectedSnacks}
                  totalAmount={totalAmount}
                  bookingTime={bookingTime}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 w-full lg:w-64 pt-8 lg:pt-20">
                <button 
                  disabled={isGeneratingPDF}
                  onClick={async () => {
                    setIsGeneratingPDF(true);
                    try {
                      await downloadTicketAsPDF(lastBookingId);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsGeneratingPDF(false);
                    }
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  Download PDF
                </button>
                <button 
                  onClick={() => downloadTicketAsTXT(lastBookingId, {
                    movie,
                    showtime: selectedShowtime,
                    seats: selectedSeats,
                    snacks: selectedSnacks,
                    totalAmount,
                    userName: profile?.displayName || user?.email?.split('@')[0] || 'Guest',
                    bookingTime
                  })}
                  className="w-full py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-bold flex items-center justify-center gap-3 hover:border-gray-900 transition-all"
                >
                  <FileText className="w-5 h-5" />
                  Download TXT
                </button>
                <button 
                  onClick={onBack}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors mt-4"
                >
                  Back to Movies
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReviewSection = ({ movieId }: { movieId: string }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'reviews'), where('movieId', '==', movieId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => {
      console.error("Firestore Error in ReviewSection:", error);
    });
    return unsubscribe;
  }, [movieId]);

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const reviewData = {
        movieId,
        userId: user.uid,
        userName: profile?.displayName || user.email?.split('@')[0] || 'Anonymous',
        rating,
        comment,
        timestamp: new Date().toISOString()
      };
      await addDoc(collection(db, 'reviews'), reviewData);
      setComment('');
      setRating(5);
    } catch (error) {
      console.error("Error adding review:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-600" />
          User Reviews
        </h3>
        {averageRating && (
          <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span className="font-black text-amber-700 text-lg">{averageRating}</span>
            <span className="text-amber-600 text-sm">({reviews.length} reviews)</span>
          </div>
        )}
      </div>

      {user && (
        <form onSubmit={handleSubmitReview} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-900">Write a Review</h4>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    className={`w-8 h-8 ${s <= rating ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`} 
                  />
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about the movie..."
            className="w-full p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-h-[120px] transition-all"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {isSubmitting ? 'Posting...' : 'Post Review'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                    {review.userName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{review.userName}</p>
                    <p className="text-xs text-gray-400">{new Date(review.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      className={`w-4 h-4 ${s <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`} 
                    />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">{review.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ShowtimePicker = ({ movieId, onSelect }: { movieId: string, onSelect: (s: Showtime) => void }) => {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'showtimes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Showtime));
      // Sort showtimes by time
      const filtered = all.filter(s => s.movieId === movieId).sort((a, b) => {
        const timeA = a.time.includes('PM') && !a.time.startsWith('12') ? parseInt(a.time) + 12 : parseInt(a.time);
        const timeB = b.time.includes('PM') && !b.time.startsWith('12') ? parseInt(b.time) + 12 : parseInt(b.time);
        return timeA - timeB;
      });
      setShowtimes(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'showtimes');
    });
    return unsubscribe;
  }, [movieId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {showtimes.map(s => (
        <button 
          key={s.id}
          onClick={() => onSelect(s)}
          className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-indigo-600 hover:shadow-lg transition-all text-left group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-indigo-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-bold">{s.date}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-900">
              <Clock className="w-4 h-4 text-indigo-600" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Showtime</span>
                <span className="text-lg font-black">{s.time}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Available seats: {64 - (s.bookedSeats?.length || 0)}/64</p>
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all" 
                style={{ width: `${((64 - (s.bookedSeats?.length || 0)) / 64) * 100}%` }} 
              />
            </div>
          </div>
        </button>
      ))}
      {showtimes.length === 0 && (
        <div className="col-span-full p-12 text-center bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No showtimes scheduled for this movie.</p>
        </div>
      )}
    </div>
  );
};

const SeatMap = ({ bookedSeats, selectedSeats, onToggle }: { bookedSeats: string[], selectedSeats: string[], onToggle: (s: string) => void }) => {
  const rows = ['A', 'B', 'C', 'D', 'E'];
  const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="space-y-10 overflow-x-auto pb-6 px-4">
      <div className="relative mx-auto max-w-[500px]">
        <div className="w-full h-3 bg-gray-300 rounded-full shadow-[0_15px_30px_rgba(0,0,0,0.15)] mb-16 relative perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-200 to-gray-400 rounded-full transform rotateX-45" />
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Cinema Screen</span>
        </div>
      </div>
      
      <div className="grid gap-4 justify-center min-w-[600px]">
        {rows.map(row => (
          <div key={row} className="flex justify-center gap-4">
            <span className="w-8 text-sm font-black text-gray-300 flex items-center justify-center">{row}</span>
            <div className="flex gap-3">
              {cols.map(col => {
                const seatId = `${row}${col}`;
                const isBooked = bookedSeats.includes(seatId);
                const isSelected = selectedSeats.includes(seatId);
                
                return (
                  <motion.button
                    key={seatId}
                    whileHover={!isBooked ? { scale: 1.1, y: -2 } : {}}
                    whileTap={!isBooked ? { scale: 0.95 } : {}}
                    disabled={isBooked}
                    onClick={() => onToggle(seatId)}
                    className={`
                      w-10 h-10 rounded-xl text-xs font-black transition-all duration-300 border-2
                      ${isBooked ? 'bg-rose-500 border-rose-600 text-white cursor-not-allowed shadow-inner opacity-80' : 
                        isSelected ? 'bg-amber-400 border-amber-500 text-amber-900 shadow-lg shadow-amber-200' : 
                        'bg-emerald-500 border-emerald-600 text-emerald-900 hover:shadow-lg hover:shadow-emerald-100'}
                    `}
                  >
                    {col}
                  </motion.button>
                );
              })}
            </div>
            <span className="w-8 text-sm font-black text-gray-300 flex items-center justify-center">{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SnackPicker = ({ selectedSnacks, onChange }: { selectedSnacks: any[], onChange: (s: any[]) => void }) => {
  const [snacks, setSnacks] = useState<Snack[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'snacks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSnacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Snack)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'snacks');
    });
    return unsubscribe;
  }, []);

  const updateQuantity = (snack: Snack, delta: number) => {
    const existing = selectedSnacks.find(s => s.name === snack.name);
    if (existing) {
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        onChange(selectedSnacks.filter(s => s.name !== snack.name));
      } else {
        onChange(selectedSnacks.map(s => s.name === snack.name ? { ...s, quantity: newQty } : s));
      }
    } else if (delta > 0) {
      onChange([...selectedSnacks, { name: snack.name, quantity: 1, price: snack.price }]);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {snacks.map(snack => {
        const qty = selectedSnacks.find(s => s.name === snack.name)?.quantity || 0;
        return (
          <div key={snack.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
            <div className="w-20 h-20 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
              <img src={snack.imageUrl || `https://picsum.photos/seed/${snack.name}/200/200`} alt={snack.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-grow">
              <h4 className="font-bold text-gray-900">{snack.name}</h4>
              <p className="text-indigo-600 font-bold">₹{snack.price}</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-xl">
              <button onClick={() => updateQuantity(snack, -1)} className="p-1 hover:bg-white rounded-lg transition-colors"><Minus className="w-4 h-4" /></button>
              <span className="w-4 text-center font-bold text-sm">{qty}</span>
              <button onClick={() => updateQuantity(snack, 1)} className="p-1 hover:bg-white rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BookingHistory = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });
    return unsubscribe;
  }, [user]);

  const handleCancel = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setConfirmCancel(null);
    } catch (error) {
      console.error("Error cancelling booking:", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">My Bookings</h1>
        <p className="text-gray-500">Your movie ticket history and upcoming shows.</p>
      </div>

      <div className="space-y-6">
        {bookings.map(booking => (
          <div key={booking.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 flex-shrink-0">
              <Ticket className="w-8 h-8" />
            </div>
            <div className="flex-grow space-y-1">
              <h3 className="text-xl font-bold text-gray-900">{booking.movieTitle}</h3>
              <p className="text-sm text-gray-500">{booking.showtime}</p>
              <div className="flex gap-2 flex-wrap pt-2">
                {booking.seats.map(s => (
                  <span key={s} className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-600">{s}</span>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-left md:text-right w-full md:w-auto">
              <p className="text-2xl font-black text-gray-900">₹{booking.totalAmount}</p>
              <p className="text-xs text-gray-400">{new Date(booking.timestamp).toLocaleDateString()}</p>
              <div className="flex gap-2 justify-start md:justify-end items-center">
                {booking.snacks.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                    <Coffee className="w-3 h-3" /> {booking.snacks.length} Snacks
                  </span>
                )}
                <button 
                  onClick={() => setConfirmCancel(booking.id)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                >
                  Cancel Booking
                </button>
              </div>
            </div>
          </div>
        ))}

        <AnimatePresence>
          {confirmCancel && (
            <Modal onClose={() => setConfirmCancel(null)}>
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Cancel Booking?</h3>
                  <p className="text-gray-500 mt-2">Are you sure you want to cancel this booking? This action cannot be undone.</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmCancel(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-900 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    No, Keep it
                  </button>
                  <button 
                    onClick={() => handleCancel(confirmCancel)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </AnimatePresence>

        {bookings.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No bookings yet</h3>
            <p className="text-gray-500">Your movie tickets will appear here.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Modal = ({ children, onClose }: { children: ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
    />
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
    >
      {children}
    </motion.div>
  </div>
);

const AddMovieForm = ({ onClose, movieToEdit }: { onClose: () => void, movieToEdit?: Movie }) => {
  const [formData, setFormData] = useState({
    title: movieToEdit?.title || '',
    genre: movieToEdit?.genre || '',
    duration: movieToEdit?.duration || '',
    price: movieToEdit?.price || 150,
    posterUrl: movieToEdit?.posterUrl || '',
    description: movieToEdit?.description || '',
    category: (movieToEdit?.category || 'Now Showing') as 'Now Showing' | 'New Releases' | 'Upcoming',
    releaseDate: movieToEdit?.releaseDate || '',
    cast: movieToEdit?.cast || ''
  });
  const [error, setError] = useState('');

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // ~800KB limit to be safe with Firestore 1MB limit
        setError('Image size should be less than 800KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, posterUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.category === 'Upcoming' && !formData.releaseDate) {
      setError('Release date is required for upcoming movies');
      return;
    }

    try {
      if (movieToEdit) {
        await updateDoc(doc(db, 'movies', movieToEdit.id), formData);
      } else {
        // Check for duplicate title
        const q = query(collection(db, 'movies'));
        const snapshot = await getDocs(q);
        const isDuplicate = snapshot.docs.some(doc => doc.data().title.toLowerCase() === formData.title.toLowerCase());
        
        if (isDuplicate) {
          setError('A movie with this title already exists');
          return;
        }

        const movieRef = await addDoc(collection(db, 'movies'), formData);
        
        // Only add showtimes for non-upcoming movies
        if (formData.category !== 'Upcoming') {
          const fixedTimings = ["11:00 AM", "02:30 PM", "06:30 PM", "10:00 PM"];
          for (const time of fixedTimings) {
            await addDoc(collection(db, 'showtimes'), {
              movieId: movieRef.id,
              date: "2026-03-20",
              time: time,
              bookedSeats: []
            });
          }
        }
      }
      onClose();
    } catch (error) {
      console.error("Error saving movie:", error);
      if (error instanceof Error && error.message.includes('Firestore Error')) {
        throw error;
      }
      setError(`Failed to ${movieToEdit ? 'update' : 'add'} movie. Please try again.`);
    }
  };

  return (
    <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-900">{movieToEdit ? 'Edit Movie' : 'Add New Movie'}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Title</label>
          <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Category</label>
            <select 
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value as any})}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
            >
              <option value="Now Showing">Now Showing</option>
              <option value="New Releases">New Releases</option>
              <option value="Upcoming">Upcoming</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Release Date</label>
            <input 
              type="text" 
              placeholder="e.g. April 2026"
              required={formData.category === 'Upcoming'}
              disabled={formData.category !== 'Upcoming'}
              value={formData.releaseDate} 
              onChange={e => setFormData({...formData, releaseDate: e.target.value})} 
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all disabled:opacity-50" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Genre</label>
            <input required value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Duration</label>
            <input required value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Price (₹)</label>
            <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Poster URL</label>
            <input required value={formData.posterUrl} onChange={e => setFormData({...formData, posterUrl: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Upload Poster</label>
          <div className="flex items-center gap-4">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl border-2 border-dashed border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-all">
              <Upload className="w-5 h-5" />
              <span className="text-sm font-bold">Choose Image</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {formData.posterUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100">
                <img src={formData.posterUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Cast</label>
          <input required value={formData.cast} onChange={e => setFormData({...formData, cast: e.target.value})} placeholder="e.g. Actor 1, Actor 2" className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Description</label>
          <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all h-24 resize-none" />
        </div>
        <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          {movieToEdit ? 'Update Movie' : 'Add Movie'}
        </button>
      </form>
    </div>
  );
};

const AddSnackForm = ({ onClose, snackToEdit }: { onClose: () => void, snackToEdit?: Snack }) => {
  const [formData, setFormData] = useState({
    name: snackToEdit?.name || '',
    price: snackToEdit?.price || 150,
    category: snackToEdit?.category || 'Food',
    imageUrl: snackToEdit?.imageUrl || ''
  });
  const [error, setError] = useState('');

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setError('Image size should be less than 800KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (snackToEdit) {
        await updateDoc(doc(db, 'snacks', snackToEdit.id), formData);
      } else {
        await addDoc(collection(db, 'snacks'), formData);
      }
      onClose();
    } catch (error) {
      console.error("Error saving snack:", error);
      if (error instanceof Error && error.message.includes('Firestore Error')) {
        throw error;
      }
      setError(`Failed to ${snackToEdit ? 'update' : 'add'} snack. Please try again.`);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-900">{snackToEdit ? 'Edit Snack' : 'Add New Snack'}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Name</label>
          <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Category</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all">
              <option>Food</option>
              <option>Drink</option>
              <option>Combo</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Price (₹)</label>
            <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Image URL</label>
          <input required value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Upload Image</label>
          <div className="flex items-center gap-4">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl border-2 border-dashed border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-all">
              <Upload className="w-5 h-5" />
              <span className="text-sm font-bold">Choose Image</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {formData.imageUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100">
                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        </div>
        <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          {snackToEdit ? 'Update Snack' : 'Add Snack'}
        </button>
      </form>
    </div>
  );
};

const AdminDashboard = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [showAddSnack, setShowAddSnack] = useState(false);
  const [movieToEdit, setMovieToEdit] = useState<Movie | null>(null);
  const [snackToEdit, setSnackToEdit] = useState<Snack | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'movie' | 'snack' | 'booking' } | null>(null);
  const [filterMovie, setFilterMovie] = useState('All');
  const [filterTime, setFilterTime] = useState('All Time');

  useEffect(() => {
    const unsubMovies = onSnapshot(collection(db, 'movies'), 
      (s) => setMovies(s.docs.map(d => ({ id: d.id, ...d.data() } as Movie))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'movies')
    );
    const unsubSnacks = onSnapshot(collection(db, 'snacks'), 
      (s) => setSnacks(s.docs.map(d => ({ id: d.id, ...d.data() } as Snack))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'snacks')
    );
    const unsubBookings = onSnapshot(collection(db, 'bookings'), 
      (s) => setBookings(s.docs.map(d => ({ id: d.id, ...d.data() } as Booking))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookings')
    );
    return () => { unsubMovies(); unsubSnacks(); unsubBookings(); };
  }, []);

  const addSampleData = async () => {
    try {
      const sampleMovies = [
        { 
          title: "Made in Korea", 
          genre: "Drama", 
          duration: "2h 15m", 
          price: 150, 
          posterUrl: "https://picsum.photos/seed/korea/400/600", 
          description: "A gripping tale of ambition and survival.", 
          category: "Now Showing",
          cast: "Priyanka Arul Mohan, Rishikanth"
        },
        { 
          title: "Parasakthi", 
          genre: "Action", 
          duration: "2h 30m", 
          price: 150, 
          posterUrl: "https://picsum.photos/seed/parasakthi/400/600", 
          description: "An epic battle for justice and honor.", 
          category: "Now Showing",
          cast: "Sivakarthikeyan, Atharvaa"
        },
        { 
          title: "Thaai Kizhavi", 
          genre: "Family", 
          duration: "2h 10m", 
          price: 120, 
          posterUrl: "https://picsum.photos/seed/thaai/400/600", 
          description: "A heartwarming story of family bonds.", 
          category: "Now Showing",
          cast: "Radhika Sarathkumar, Singampuli"
        },
        { 
          title: "Vikram's Film", 
          genre: "Thriller", 
          duration: "2h 45m", 
          price: 180, 
          posterUrl: "https://picsum.photos/seed/vikram/400/600", 
          description: "A high-stakes mystery that will keep you guessing.", 
          category: "Upcoming",
          releaseDate: "March 27",
          cast: "Vikram, S.J. Suryah"
        },
        { 
          title: "Jailer 2", 
          genre: "Action", 
          duration: "2h 50m", 
          price: 200, 
          posterUrl: "https://picsum.photos/seed/jailer2/400/600", 
          description: "The legend returns for his biggest mission yet.", 
          category: "Upcoming",
          releaseDate: "April 2026",
          cast: "Rajinikanth, S.J. Suryah"
        }
      ];

      const existingMovies = movies.map(m => m.title.toLowerCase());

      for (const m of sampleMovies) {
        if (existingMovies.includes(m.title.toLowerCase())) continue;

        const movieRef = await addDoc(collection(db, 'movies'), m);
        
        // Add default show timings for all movies
        const fixedTimings = ["11:00 AM", "02:30 PM", "06:30 PM", "10:00 PM"];
        for (const time of fixedTimings) {
          await addDoc(collection(db, 'showtimes'), {
            movieId: movieRef.id,
            date: "2026-03-20",
            time: time,
            bookedSeats: []
          });
        }
      }
      
      const sampleSnacks = [
        { name: "Large Popcorn", price: 8, category: "Food", imageUrl: "https://picsum.photos/seed/popcorn/200/200" },
        { name: "Coca Cola", price: 4, category: "Drink", imageUrl: "https://picsum.photos/seed/coke/200/200" },
        { name: "Nachos with Cheese", price: 6, category: "Food", imageUrl: "https://picsum.photos/seed/nachos/200/200" }
      ];
      
      const existingSnacks = snacks.map(s => s.name.toLowerCase());
      for (const s of sampleSnacks) {
        if (!existingSnacks.includes(s.name.toLowerCase())) {
          await addDoc(collection(db, 'snacks'), s);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sample-data');
    }
  };

  const deleteMovie = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'movies', id));
      const q = query(collection(db, 'showtimes'));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(async (d) => {
        if (d.data().movieId === id) {
          await deleteDoc(doc(db, 'showtimes', d.id));
        }
      });
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `movies/${id}`);
    }
  };

  const deleteSnack = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'snacks', id));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `snacks/${id}`);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesMovie = filterMovie === 'All' || booking.movieTitle === filterMovie;
    
    let matchesTime = true;
    const bookingDate = new Date(booking.timestamp);
    const now = new Date();
    
    if (filterTime === 'Today') {
      matchesTime = bookingDate.toDateString() === now.toDateString();
    } else if (filterTime === 'Last 7 Days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      matchesTime = bookingDate >= sevenDaysAgo;
    } else if (filterTime === 'Last 30 Days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      matchesTime = bookingDate >= thirtyDaysAgo;
    }
    
    return matchesMovie && matchesTime;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500">Manage theater operations and view analytics.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={addSampleData}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
          >
            Seed Sample Data
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filter by Movie</label>
          <select 
            value={filterMovie}
            onChange={(e) => setFilterMovie(e.target.value)}
            className="block w-48 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
          >
            <option value="All">All Movies</option>
            {Array.from(new Set(bookings.map(b => b.movieTitle))).map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time Period</label>
          <select 
            value={filterTime}
            onChange={(e) => setFilterTime(e.target.value)}
            className="block w-48 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
          >
            <option value="All Time">All Time</option>
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-500 font-medium">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Revenue</p>
          <p className="text-4xl font-black text-gray-900">₹{filteredBookings.reduce((acc, b) => acc + b.totalAmount, 0)}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Bookings</p>
          <p className="text-4xl font-black text-gray-900">{filteredBookings.length}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Active Movies</p>
          <p className="text-4xl font-black text-gray-900">{movies.length}</p>
        </div>
      </div>

      <AnimatePresence>
        {(showAddMovie || movieToEdit) && (
          <Modal onClose={() => { setShowAddMovie(false); setMovieToEdit(null); }}>
            <AddMovieForm 
              onClose={() => { setShowAddMovie(false); setMovieToEdit(null); }} 
              movieToEdit={movieToEdit || undefined}
            />
          </Modal>
        )}
        {(showAddSnack || snackToEdit) && (
          <Modal onClose={() => { setShowAddSnack(false); setSnackToEdit(null); }}>
            <AddSnackForm 
              onClose={() => { setShowAddSnack(false); setSnackToEdit(null); }} 
              snackToEdit={snackToEdit || undefined}
            />
          </Modal>
        )}
        {confirmDelete && (
          <Modal onClose={() => setConfirmDelete(null)}>
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Deletion</h3>
                <p className="text-gray-500 mt-2">Are you sure you want to delete this {confirmDelete.type}? This action cannot be undone.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-900 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (confirmDelete.type === 'movie') deleteMovie(confirmDelete.id);
                    else if (confirmDelete.type === 'snack') deleteSnack(confirmDelete.id);
                    else if (confirmDelete.type === 'booking') deleteBooking(confirmDelete.id);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Movie Management</h2>
          <button 
            onClick={() => setShowAddMovie(true)}
            className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Movie
          </button>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Movie</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Genre</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movies.map(movie => (
                <tr key={movie.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{movie.title}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      movie.category === 'Now Showing' ? 'bg-emerald-50 text-emerald-600' :
                      movie.category === 'New Releases' ? 'bg-indigo-50 text-indigo-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {movie.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{movie.genre}</td>
                  <td className="px-6 py-4 text-indigo-600 font-bold">₹{movie.price}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setMovieToEdit(movie)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ id: movie.id, type: 'movie' })}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Snack Management</h2>
          <button 
            onClick={() => setShowAddSnack(true)}
            className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Snack
          </button>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Snack</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {snacks.map(snack => (
                <tr key={snack.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{snack.name}</td>
                  <td className="px-6 py-4 text-gray-500">{snack.category}</td>
                  <td className="px-6 py-4 text-indigo-600 font-bold">₹{snack.price}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSnackToEdit(snack)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ id: snack.id, type: 'snack' })}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-gray-900">Filtered Bookings</h2>
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">User ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Movie</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Seats</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBookings.slice(0, 20).map(booking => (
                <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-xs text-gray-500 font-mono">{booking.userId}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{booking.movieTitle}</td>
                  <td className="px-6 py-4 text-gray-500">{booking.seats.join(', ')}</td>
                  <td className="px-6 py-4 text-indigo-600 font-bold">₹{booking.totalAmount}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setConfirmDelete({ id: booking.id, type: 'booking' })}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
