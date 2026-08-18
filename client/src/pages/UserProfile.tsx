import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

export default function UserProfile() {
  const { user } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('12, 5th Block, Koramangala, Bengaluru');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-primary">ACCOUNT & PREFERENCES</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Personal Profile</h1>
        <p className="mt-2 text-slate-500">Manage your contact details and default location settings.</p>

        {saved && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800">
            ✓ Settings saved successfully (Local state)
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_2fr]">
          {/* Avatar Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-center h-fit">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-teal-50 text-3xl font-bold text-primary">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <h2 className="mt-4 font-bold text-slate-900 text-lg">{user?.name}</h2>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <span className="mt-3 inline-block rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-primary">
              {user?.role === 'PROVIDER' ? 'Service Provider' : 'Customer Account'}
            </span>

            <div className="mt-6 border-t border-slate-100 pt-4 space-y-2 text-xs">
              <Link to="/history" className="block w-full py-2 font-semibold text-slate-700 hover:text-primary">
                📋 View Booking History
              </Link>
            </div>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSave} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">Personal Information</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Primary Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
