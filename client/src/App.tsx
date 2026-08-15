import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Home from './pages/Home';
import Providers from './pages/Providers';
import Book from './pages/Book';
import Track from './pages/Track';
import Login from './pages/Login';
import Register from './pages/Register';

const queryClient = new QueryClient();

function Navigation() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-lg tracking-wide hover:opacity-90 transition">
            Essential Services
          </Link>
          <div className="flex gap-4 text-sm font-medium">
            <Link to="/" className="hover:text-blue-200 transition">Home</Link>
            <Link to="/providers" className="hover:text-blue-200 transition">Find Providers</Link>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          {user ? (
            <>
              <span className="hidden sm:inline opacity-90">Hi, {user.name} ({user.role})</span>
              <button
                onClick={logout}
                className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded transition text-xs font-semibold"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-blue-200 transition">Login</Link>
              <Link to="/register" className="bg-white text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition text-xs font-semibold">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navigation />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/book/:providerId" element={<Book />} />
              <Route path="/track/:bookingId" element={<Track />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;