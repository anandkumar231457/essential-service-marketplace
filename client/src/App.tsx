import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Home from './pages/Home';
import Providers from './pages/Providers';
import Book from './pages/Book';
import Track from './pages/Track';
import Login from './pages/Login';
import Register from './pages/Register';
import ProviderDashboard from './pages/ProviderDashboard';
import History from './pages/History';
import Review from './pages/Review';
import BookingConfirmation from './pages/BookingConfirmation';
import ProviderProfilePage from './pages/ProviderProfile';
import UserProfile from './pages/UserProfile';
import ProviderEarnings from './pages/ProviderEarnings';
import ProviderAvailability from './pages/ProviderAvailability';
import ProviderCoverage from './pages/ProviderCoverage';
import ProviderServices from './pages/ProviderServices';
import MobileNav from './components/MobileNav';

const queryClient = new QueryClient();

function Navigation() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-lg text-white">✦</span> FixIt<span className="text-primary">Now</span>
          </Link>
          <div className="hidden gap-6 text-sm font-medium text-slate-500 md:flex">
            <Link to="/" className="transition hover:text-primary">Explore</Link>
            <Link to="/providers" className="transition hover:text-primary">Find a pro</Link>
            {user && (
              <Link to={user.role === 'PROVIDER' ? '/provider' : '/history'} className="transition hover:text-primary">
                {user.role === 'PROVIDER' ? 'My work' : 'My bookings'}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
          {user ? (
            <>
              <Link to="/profile" className="hidden sm:inline transition hover:text-primary">
                Hi, {user.name}
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition hover:border-primary hover:text-primary"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="transition hover:text-primary">Login</Link>
              <Link to="/register" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 hidden md:block">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="mb-4 flex items-center gap-2 font-bold text-white">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary">✦</span> FixIt<span className="text-primary">Now</span>
          </div>
          <p className="max-w-xs text-sm leading-6">Connecting homeowners with trusted local professionals for every repair, big or small.</p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Our services</h3>
          <div className="space-y-2 text-sm"><p>Electrical</p><p>Plumbing</p><p>Appliance repair</p><p>Cleaning</p></div>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Company</h3>
          <div className="space-y-2 text-sm"><p>About us</p><p>How it works</p><p>Support</p></div>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">For providers</h3>
          <div className="space-y-2 text-sm"><p>Join as a pro</p><p>Provider login</p><p>Resources</p></div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-slate-800 px-5 py-5 text-xs sm:flex-row sm:justify-between lg:px-8">
        <span>© 2026 FixItNow Marketplace. All rights reserved.</span>
        <span>Privacy policy &nbsp; Terms of service</span>
      </div>
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-[#f7fafb] flex flex-col">
          <Navigation />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/providers/:providerId" element={<ProviderProfilePage />} />
              <Route path="/book/:providerId" element={<Book />} />
              <Route path="/track/:bookingId" element={<Track />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/provider" element={<ProviderDashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/review/:bookingId" element={<Review />} />
              <Route path="/booking/:bookingId/confirmed" element={<BookingConfirmation />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/provider/earnings" element={<ProviderEarnings />} />
              <Route path="/provider/availability" element={<ProviderAvailability />} />
              <Route path="/provider/coverage" element={<ProviderCoverage />} />
              <Route path="/provider/services" element={<ProviderServices />} />
            </Routes>
          </main>
          <MobileNav />
          <Footer />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
