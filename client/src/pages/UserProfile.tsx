import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function UserProfile() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [lat, setLat] = useState<number>(user?.lat || 12.9352);
  const [lng, setLng] = useState<number>(user?.lng || 77.6245);
  const [gpsStatus, setGpsStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Fetch latest user details from server
    api
      .get<{ user: any }>('/api/users/me')
      .then((res) => {
        if (res.user) {
          setName(res.user.name || '');
          setEmail(res.user.email || '');
          setPhone(res.user.phone || '');
          if (res.user.address) setAddress(res.user.address);
          if (typeof res.user.lat === 'number') setLat(res.user.lat);
          if (typeof res.user.lng === 'number') setLng(res.user.lng);
          updateUser(res.user);
        }
      })
      .catch(() => {});
  }, [updateUser]);

  const handleDetectGPS = () => {
    if (navigator.geolocation) {
      setGpsStatus('Detecting GPS location…');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGpsStatus(`📍 GPS location set (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        },
        () => {
          setGpsStatus('⚠️ GPS access denied.');
        }
      );
    } else {
      setGpsStatus('⚠️ Geolocation not supported on browser.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await api.put<{ user: any }>('/api/users/me', {
        name,
        phone,
        email,
        address,
        lat,
        lng,
      });
      updateUser(res.user);
      setSavedMsg('✓ Profile & address permanently saved to your account!');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-primary">ACCOUNT & PREFERENCES</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Personal Profile</h1>
        <p className="mt-2 text-slate-500">Manage your contact details, service address, and default map location.</p>

        {savedMsg && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800">
            {savedMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_2fr]">
          {/* Avatar Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-center h-fit">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-teal-50 text-3xl font-bold text-primary">
              {name.charAt(0) || 'U'}
            </div>
            <h2 className="mt-4 font-bold text-slate-900 text-lg">{name}</h2>
            <p className="text-xs text-slate-500">{email}</p>
            <span className="mt-3 inline-block rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-primary">
              {user?.role === 'PROVIDER' ? 'Service Provider Pro' : 'Customer Account'}
            </span>

            <div className="mt-6 border-t border-slate-100 pt-4 space-y-2 text-xs">
              <Link to="/history" className="block w-full py-2 font-semibold text-slate-700 hover:text-primary">
                📋 View Booking History
              </Link>
              {user?.role === 'PROVIDER' && (
                <Link to="/provider" className="block w-full py-2 font-semibold text-primary hover:underline">
                  🔧 Open Provider Console
                </Link>
              )}
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
                required
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
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Primary Location / Address
                </label>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  📍 Detect My GPS Location
                </button>
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12, 5th Block, Koramangala, Bengaluru"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
              {gpsStatus && <p className="mt-1 text-xs text-slate-500 font-medium">{gpsStatus}</p>}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving to Account…' : 'Save Changes Permanently'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
