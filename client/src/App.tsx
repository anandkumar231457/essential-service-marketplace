import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
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
import PostJob from './pages/PostJob';
import MobileNav from './components/MobileNav';

const queryClient = new QueryClient();

function Navigation() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCity, setSelectedCity] = useState('San Francisco, CA');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const cities = ['San Francisco, CA', 'Bengaluru, KA', 'New York, NY', 'Austin, TX', 'Seattle, WA'];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
        {/* Left: Brand Logo + Location Selector */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-white font-bold text-base shadow-sm">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.6C.5 7 1 10 3 12c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1.1 0-1.3z" />
              </svg>
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">
              FixIt<span className="text-teal-600">Now</span>
            </span>
          </Link>

          {/* Location Selector Dropdown */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <span className="text-teal-600 text-sm">📍</span>
              <span>{selectedCity}</span>
              <span className="text-[10px] text-slate-400">∨</span>
            </button>

            {showCityDropdown && (
              <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl z-50">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedCity(city);
                      setShowCityDropdown(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                      selectedCity === city
                        ? 'bg-teal-50 text-teal-800 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center/Right Nav Links */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <Link
              to="/"
              className={`transition hover:text-teal-600 ${isActive('/') ? 'text-teal-600 font-bold' : ''}`}
            >
              Explore
            </Link>

            {user?.role === 'PROVIDER' ? (
              <Link
                to="/provider"
                className={`transition hover:text-teal-600 ${isActive('/provider') ? 'text-teal-600 font-bold' : ''}`}
              >
                Specialist Dashboard
              </Link>
            ) : (
              <Link
                to="/history"
                className={`transition hover:text-teal-600 ${isActive('/history') ? 'text-teal-600 font-bold' : ''}`}
              >
                My Bookings
              </Link>
            )}

            <Link
              to="/providers"
              className={`transition hover:text-teal-600 ${isActive('/providers') ? 'text-teal-600 font-bold' : ''}`}
            >
              Find a Pro
            </Link>

            <Link
              to="/profile"
              className={`transition hover:text-teal-600 ${isActive('/profile') ? 'text-teal-600 font-bold' : ''}`}
            >
              Support
            </Link>
          </div>

          {/* User Auth Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {user.role !== 'PROVIDER' && (
                  <Link
                    to="/post-job"
                    className="rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hidden sm:inline-flex items-center gap-1.5"
                  >
                    <span>⚡</span> Request Service
                  </Link>
                )}

                {/* Notification Bell */}
                <button
                  onClick={() => navigate(user.role === 'PROVIDER' ? '/provider' : '/history')}
                  className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:text-teal-600 transition"
                  title="Notifications"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white"></span>
                </button>

                {/* Profile Avatar / Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 rounded-full p-0.5 border border-slate-200/80 hover:border-teal-500 transition"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-teal-600 to-teal-400 text-xs font-bold text-white shadow-sm overflow-hidden">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl z-50 space-y-1">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                        <span className="mt-1 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                          {user.role === 'PROVIDER' ? 'Specialist Pro' : 'Customer'}
                        </span>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="block rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        👤 Personal Profile & Settings
                      </Link>

                      <Link
                        to={user.role === 'PROVIDER' ? '/provider' : '/history'}
                        onClick={() => setShowUserMenu(false)}
                        className="block rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        📋 {user.role === 'PROVIDER' ? 'Specialist Dashboard' : 'My Booking History'}
                      </Link>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full text-left rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0B132B] text-slate-400 mt-auto pt-16 pb-8 border-t border-slate-800/80">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 pb-12 border-b border-slate-800/80">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5 font-bold text-white">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-teal-500 text-white font-bold text-sm shadow-sm">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.6C.5 7 1 10 3 12c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1.1 0-1.3z" />
                </svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                FixIt<span className="text-teal-400">Now</span>
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              Connecting homeowners and businesses with top-tier local service professionals. Trust, safety, and speed guaranteed.
            </p>
          </div>

          {/* Our Services */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Our Services</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/providers?category=Plumbing" className="hover:text-teal-400 transition">Plumbing</Link></li>
              <li><Link to="/providers?category=Electrical" className="hover:text-teal-400 transition">Electrical</Link></li>
              <li><Link to="/providers?category=AC Repair" className="hover:text-teal-400 transition">AC Repair</Link></li>
              <li><Link to="/providers?category=Cleaning" className="hover:text-teal-400 transition">Cleaning</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Company</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/" className="hover:text-teal-400 transition">About Us</Link></li>
              <li><Link to="/" className="hover:text-teal-400 transition">Careers</Link></li>
              <li><Link to="/" className="hover:text-teal-400 transition">Press</Link></li>
              <li><Link to="/" className="hover:text-teal-400 transition">Trust & Safety</Link></li>
            </ul>
          </div>

          {/* For Providers */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">For Providers</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/register" className="hover:text-teal-400 transition">Join as Pro</Link></li>
              <li><Link to="/provider" className="hover:text-teal-400 transition">Pro Portal</Link></li>
              <li><Link to="/providers" className="hover:text-teal-400 transition">Resources</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 FixItNow Marketplace Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-slate-400 transition">Privacy Policy</Link>
            <Link to="/" className="hover:text-slate-400 transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-[#f7fafb] flex flex-col font-sans">
          <Navigation />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/providers/:providerId" element={<ProviderProfilePage />} />
              <Route path="/book/:providerId" element={<Book />} />
              <Route path="/book" element={<Book />} />
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
              <Route path="/post-job" element={<PostJob />} />
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
