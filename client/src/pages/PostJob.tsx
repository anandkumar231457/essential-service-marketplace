import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking, ServiceCategory } from '../types';
import DatePicker from '../components/DatePicker';
import TimeSlotPicker from '../components/TimeSlotPicker';

export default function PostJob() {
  const navigate = useNavigate();

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'locked' | 'denied'>('detecting');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM - 10:00 AM');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [error, setError] = useState('');

  // Auto-detect GPS on page load
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsStatus('locked');
      },
      () => {
        setGpsStatus('denied');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const handleGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsStatus('locked');
      },
      () => setGpsStatus('denied'),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  const categoryId = categoriesData?.categories.find(
    (c) => c.name === selectedCategory,
  )?.id;

  const postMutation = useMutation({
    mutationFn: () => {
      // Use actual GPS if locked, fallback to Bangalore city center only if denied
      const jobLat = lat ?? 12.9716;
      const jobLng = lng ?? 77.5946;
      return api.post<{ booking: Booking; nearbyWorkersCount: number }>('/api/bookings/request', {
        categoryId,
        address,
        lat: jobLat,
        lng: jobLng,
        scheduledAt: new Date(selectedDate).toISOString(),
        description,
        // No providerId — open job broadcast to all nearby providers
      });
    },
    onSuccess: (data) => {
      navigate(`/booking/${data.booking.id}/confirmed`);
    },
    onError: (err: any) => setError(err.message || 'Failed to post job'),
  });

  const gpsLocked = gpsStatus === 'locked';
  const canPost = Boolean(address) && Boolean(selectedCategory) && categoryId !== undefined && (gpsLocked || gpsStatus === 'denied');


  return (
    <div className="bg-[#f7fafb] py-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-3xl px-5">
        <button onClick={() => navigate(-1)} className="text-xs font-semibold text-primary hover:underline mb-4">
          ← Back
        </button>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-slate-100 pb-4">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              🛵 Open Job Board
            </span>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">Post a Service Job</h1>
            <p className="mt-1 text-xs text-slate-500">
              Your request will be broadcast to all available specialists nearby — just like ordering on Swiggy. 
              Any verified pro in your area can pick it up and come to you.
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 border border-rose-200">
              {error}
            </p>
          )}

          {/* Service Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
              Type of Service Needed *
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
                  className={`rounded-xl border px-4 py-3 text-xs font-semibold transition text-left ${
                    selectedCategory === cat.name
                      ? 'border-primary bg-teal-50 text-primary ring-2 ring-teal-100'
                      : 'border-slate-200 text-slate-700 hover:border-teal-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <TimeSlotPicker selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />

          {/* Address & GPS */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            {/* GPS Status Banner */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-semibold ${
              gpsStatus === 'locked' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
              gpsStatus === 'detecting' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              <span>
                {gpsStatus === 'locked' && `📍 GPS Locked — ${lat?.toFixed(5)}, ${lng?.toFixed(5)}`}
                {gpsStatus === 'detecting' && '⏳ Detecting your GPS location…'}
                {gpsStatus === 'denied' && '⚠️ GPS denied — tap below to retry or enter address manually'}
                {gpsStatus === 'idle' && '📍 GPS not started'}
              </span>
              <button type="button" onClick={handleGps} className="underline ml-2 shrink-0">
                {gpsStatus === 'locked' ? 'Refresh' : 'Retry GPS'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                Service Address *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12, 5th Block, Koramangala, Bengaluru"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
              <p className="mt-1 text-xs text-slate-400">Enter your full address for the specialist to find you.</p>
            </div>


            {/* Problem Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                Describe the Problem *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail (e.g. Water leak under kitchen sink since morning, need urgent fix)..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 h-24"
              />
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-2xl bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-700">⚡ How it works</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { step: '1', label: 'Post your job', icon: '📋' },
                { step: '2', label: 'Provider picks up', icon: '🛵' },
                { step: '3', label: 'Work gets done', icon: '✅' },
              ].map((item) => (
                <div key={item.step} className="space-y-1">
                  <div className="text-2xl">{item.icon}</div>
                  <p className="text-[10px] font-semibold text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || !canPost}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {postMutation.isPending ? 'Broadcasting to Nearby Pros…' : '🛵 Post Job & Find Specialist'}
          </button>
        </div>
      </div>
    </div>
  );
}
