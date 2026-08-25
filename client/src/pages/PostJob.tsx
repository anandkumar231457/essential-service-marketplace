import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking, ServiceCategory } from '../types';
import DatePicker from '../components/DatePicker';
import TimeSlotPicker from '../components/TimeSlotPicker';

export default function PostJob() {
  const navigate = useNavigate();

  // Location mode: 'gps' (default, no manual address typing needed) or 'manual'
  const [locationMode, setLocationMode] = useState<'gps' | 'manual'>('gps');
  
  // GPS state
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'locked' | 'denied'>('detecting');
  const [detectedAddress, setDetectedAddress] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');

  // Manual address state
  const [manualAddress, setManualAddress] = useState<string>('');

  // Service details
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM - 10:00 AM');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Reverse geocoding helper (OpenStreetMap Nominatim)
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setDetectedAddress(data.display_name);
          return;
        }
      }
    } catch {
      // Ignore network failure, fall back to coordinate string
    }
    setDetectedAddress(`Live GPS Location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
  };

  // Acquire device GPS location
  const acquireGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus('locked');
        reverseGeocode(latitude, longitude);
      },
      () => {
        setGpsStatus('denied');
        // Fallback default coordinates (Koramangala/Bengaluru)
        if (!lat || !lng) {
          setLat(12.9352);
          setLng(77.6245);
          setDetectedAddress('Koramangala, Bengaluru (Default Location)');
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // Auto-acquire GPS on page load
  useEffect(() => {
    acquireGps();
  }, []);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  const categoryId = categoriesData?.categories.find(
    (c) => c.name === selectedCategory,
  )?.id;

  const postMutation = useMutation({
    mutationFn: () => {
      // Determine final address and coordinates
      let finalLat = lat ?? 12.9352;
      let finalLng = lng ?? 77.6245;
      let finalAddress = '';

      if (locationMode === 'gps') {
        const baseAddr = detectedAddress || `Live GPS Location (${finalLat.toFixed(5)}, ${finalLng.toFixed(5)})`;
        finalAddress = landmark.trim() ? `${landmark.trim()}, ${baseAddr}` : baseAddr;
      } else {
        finalAddress = manualAddress.trim() || `Location (${finalLat.toFixed(5)}, ${finalLng.toFixed(5)})`;
      }

      return api.post<{ booking: Booking; nearbyWorkersCount: number }>('/api/bookings/request', {
        categoryId,
        address: finalAddress,
        lat: finalLat,
        lng: finalLng,
        scheduledAt: new Date(selectedDate).toISOString(),
        description,
        radiusKm: 25,
      });
    },
    onSuccess: (data) => {
      navigate(`/booking/${data.booking.id}/confirmed`);
    },
    onError: (err: any) => setError(err.message || 'Failed to post job'),
  });

  // Validation: In GPS mode, user only needs to select category! Zero address filling needed.
  const isGpsReady = locationMode === 'gps';
  const isManualValid = locationMode === 'manual' && manualAddress.trim().length > 0;
  const canPost = Boolean(selectedCategory) && categoryId !== undefined && (isGpsReady || isManualValid);

  return (
    <div className="bg-[#f7fafb] py-8 pb-20 md:pb-10 min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <button onClick={() => navigate(-1)} className="text-xs font-semibold text-primary hover:underline mb-4 inline-flex items-center gap-1">
          ← Back to Marketplace
        </button>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 flex items-center gap-1">
                🛵 Swiggy/Zomato Style Instant Dispatch
              </span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">Post a Service Job</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Your job will be dispatched in real-time to active verified specialists nearest to your device GPS.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Service Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
              1. What service do you need? *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(categoriesData?.categories ?? [
                { id: '1', name: 'Electrician' },
                { id: '2', name: 'Plumber' },
                { id: '3', name: 'AC Technician' },
                { id: '4', name: 'Carpenter' },
                { id: '5', name: 'Cleaner' },
                { id: '6', name: 'Appliance Repair' },
              ]).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`rounded-xl border p-3.5 text-xs font-semibold transition text-left flex items-center justify-between ${
                    selectedCategory === cat.name
                      ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-200 font-bold'
                      : 'border-slate-200 text-slate-700 hover:border-teal-200 bg-white'
                  }`}
                >
                  <span>{cat.name}</span>
                  {selectedCategory === cat.name && <span className="text-teal-600 font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid sm:grid-cols-2 gap-4">
            <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <TimeSlotPicker selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />
          </div>

          {/* 📍 DEVICE GPS / LOCATION SECTION */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                2. Service Location *
              </label>
              
              {/* Toggle Location Mode */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => { setLocationMode('gps'); if (!lat) acquireGps(); }}
                  className={`rounded-md px-3 py-1 transition ${
                    locationMode === 'gps'
                      ? 'bg-white text-teal-800 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📍 Use Device GPS (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMode('manual')}
                  className={`rounded-md px-3 py-1 transition ${
                    locationMode === 'manual'
                      ? 'bg-white text-teal-800 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✍️ Type Address
                </button>
              </div>
            </div>

            {/* GPS MODE CONTAINER */}
            {locationMode === 'gps' && (
              <div className="rounded-2xl border-2 border-teal-500/40 bg-teal-50/50 p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-600 text-white font-bold text-xs">
                        📍
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {gpsStatus === 'locked' ? 'Device GPS Locked' : gpsStatus === 'detecting' ? 'Acquiring GPS…' : 'GPS Permission Needed'}
                      </span>
                      {gpsStatus === 'locked' && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Active & Ready
                        </span>
                      )}
                    </div>

                    {gpsStatus === 'locked' && lat && lng && (
                      <p className="text-xs text-slate-600 pl-9 font-mono">
                        GPS Coordinates: <span className="font-semibold text-slate-900">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                        {accuracy !== null && <span className="text-slate-400"> (Accuracy: ±{accuracy}m)</span>}
                      </p>
                    )}

                    {gpsStatus === 'detecting' && (
                      <p className="text-xs text-slate-500 pl-9 animate-pulse">
                        Fetching high-accuracy coordinates from your device…
                      </p>
                    )}

                    {gpsStatus === 'denied' && (
                      <p className="text-xs text-amber-700 pl-9">
                        GPS permission not granted. Tap below to retry or switch to "Type Address".
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={acquireGps}
                    className="shrink-0 rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition flex items-center gap-1"
                  >
                    🔄 Refresh GPS
                  </button>
                </div>

                {/* Auto-detected address banner */}
                {detectedAddress && (
                  <div className="rounded-xl bg-white p-3 border border-teal-100 text-xs space-y-1 shadow-sm">
                    <span className="font-bold text-teal-800">📍 Detected Location:</span>
                    <p className="text-slate-700 font-medium break-words">{detectedAddress}</p>
                  </div>
                )}

                {/* Optional Landmark / Door No */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Flat / House No. or Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Flat 302, Green Glen Apartments, near water tank"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </div>
            )}

            {/* MANUAL MODE CONTAINER */}
            {locationMode === 'manual' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter Complete Service Address *
                  </label>
                  <textarea
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="e.g. No 45, 7th Main, 4th Block, Koramangala, Bengaluru, Karnataka 560034"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 h-20"
                  />
                </div>
              </div>
            )}

            {/* Problem Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                3. Describe the Problem (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Kitchen light flickering and main MCB tripping, need urgent electrician fix..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 h-20"
              />
            </div>
          </div>

          {/* Quick Summary Info */}
          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <p className="font-bold text-slate-800">Direct Swiggy-Style Dispatch</p>
                <p className="text-[11px] text-slate-500">Order broadcasted to nearest pros based on your device GPS.</p>
              </div>
            </div>
            <span className="font-extrabold text-slate-900 text-sm">₹500 / hr</span>
          </div>

          <button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || !canPost}
            className="w-full rounded-2xl bg-teal-600 py-3.5 font-bold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {postMutation.isPending
              ? '📡 Dispatching to Nearby Specialists…'
              : '🛵 Post Job & Dispatch to Nearby Pros'}
          </button>
        </div>
      </div>
    </div>
  );
}
