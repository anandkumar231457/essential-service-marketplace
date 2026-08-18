import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';
import GoogleSignInButton from '../components/GoogleSignInButton';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleModal, setGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('user@gmail.com');
  const [googleName, setGoogleName] = useState('Google User');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/api/auth/login', { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate(data.user.role === 'PROVIDER' ? '/provider' : '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function processGoogleAuth(payload: { email: string; name: string }) {
    setError('');
    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/api/auth/google', {
        email: payload.email,
        name: payload.name,
        role: 'CUSTOMER',
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
      setGoogleModal(false);
      navigate(data.user.role === 'PROVIDER' ? '/provider' : '/');
    } catch (err: any) {
      setError(err.message || 'Google Auth failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f7fafb] px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mx-auto mb-6 grid h-11 w-11 place-items-center rounded-xl bg-primary text-xl text-white">✦</div>
        <p className="text-center text-sm font-semibold text-primary">WELCOME BACK</p>
        <h1 className="mt-2 text-3xl font-bold text-center text-slate-900">Sign in to FixItNow</h1>
        <p className="mt-3 mb-7 text-center text-sm text-slate-500">Manage your repairs and keep track of every visit.</p>
        
        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        {/* Real Google GIS Official Button */}
        <div className="mb-4">
          <GoogleSignInButton
            text="continue_with"
            onSuccess={(user) => processGoogleAuth(user)}
            onError={(msg) => setError(msg)}
          />
        </div>

        {/* Alternative Google Modal Button */}
        <button
          type="button"
          onClick={() => setGoogleModal(true)}
          className="mb-6 flex w-full items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-primary transition"
        >
          <span>🌐 Switch / Manual Google Account Selection</span>
        </button>

        <div className="relative mb-6 flex items-center justify-center border-b border-slate-100">
          <span className="absolute bg-white px-3 text-xs text-slate-400 font-medium">OR WITH EMAIL</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register
          </Link>
        </p>

        {/* Manual Google Account Selection Modal */}
        {googleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Google Account Login</h3>
                <button onClick={() => setGoogleModal(false)} className="text-slate-400 text-sm font-bold">✕</button>
              </div>
              <p className="text-xs text-slate-500">Select or enter your Google Account email:</p>
              <form onSubmit={(e) => { e.preventDefault(); processGoogleAuth({ email: googleEmail, name: googleName }); }} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Google Email</label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-teal-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-teal-200 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-white transition hover:bg-teal-700"
                >
                  {loading ? 'Authenticating…' : 'Sign in as ' + googleEmail}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
