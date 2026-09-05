import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Booking, ServiceCategory } from '../types';

export default function Book() {
  const { providerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get('category') ?? 'Plumbing';

  // Form states
  const [selectedSubCategory, setSelectedSubCategory] = useState('Standard Leak Repair');
  const [suggestedIssue, setSuggestedIssue] = useState('Dripping Faucet');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM - 11:00 AM');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');

  // GPS state - auto-acquire real location for dispatch to work correctly
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; address: string }>({
    lat: 12.9352, lng: 77.6245, address: 'Detecting your location…',
  });
  const gpsAcquiredRef = useRef(false);

  useEffect(() => {
    if (gpsAcquiredRef.current) return;
    gpsAcquiredRef.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = `Live GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`, { headers: { 'Accept-Language': 'en' } });
          if (r.ok) { const d = await r.json(); if (d?.display_name) address = d.display_name; }
        } catch { /* ignore */ }
        setGpsCoords({ lat, lng, address });
      },
      () => { /* keep default Bengaluru coords as fallback */ },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
    );
  }, []);

  // Resolve categoryId
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  const categoryId = categoriesData?.categories.find(
    (c) => c.name.toLowerCase() === initialCategory.toLowerCase()
  )?.id || 1;

  // Suggested issues by category
  const suggestedIssues = [
    'Burst Pipe',
    'Dripping Faucet',
    'Low Water Pressure',
    'Toilet Clog',
    'Water Heater Leak',
  ];

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post<{ booking: Booking }>('/api/bookings/request', {
        providerId: providerId !== '1' ? providerId : null,
        categoryId,
        address: gpsCoords.address,
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
        scheduledAt: new Date(selectedDate).toISOString(),
        description: `${selectedSubCategory} - ${suggestedIssue}: ${description}`,
      }),
    onSuccess: (data) => {
      navigate(`/booking/${data.booking.id}/confirmed`);
    },
    onError: (err: any) => setError(err.message || 'Booking failed'),
  });


  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setUploadedPhotos([...uploadedPhotos, fileName]);
    }
  };

  return (
    <div className="bg-[#f7fafb] px-4 py-10 sm:px-6 lg:px-8 pb-24 md:pb-16 min-h-screen">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Left Column: Form Details */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Schedule Repair Service
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                Customize your service request, select issue type, and choose an appointment slot.
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Select Specific Problem Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Select Specific Problem Category
              </label>
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <option value="Standard Leak Repair">Standard Leak Repair</option>
                <option value="Drain Cleaning & Unclogging">Drain Cleaning & Unclogging</option>
                <option value="Water Heater Service">Water Heater Service</option>
                <option value="Pipe Replacement & Fitting">Pipe Replacement & Fitting</option>
                <option value="Emergency Diagnostic">Emergency Diagnostic</option>
              </select>
            </div>

            {/* Suggested Issues Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Suggested Issues
              </label>
              <div className="flex flex-wrap gap-2.5">
                {suggestedIssues.map((issue) => {
                  const isSelected = suggestedIssue === issue;
                  return (
                    <button
                      key={issue}
                      type="button"
                      onClick={() => setSuggestedIssue(issue)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                        isSelected
                          ? 'bg-[#E6F7F5] border border-teal-400 text-teal-800 shadow-2xs'
                          : 'border border-slate-200 text-slate-600 hover:border-teal-200 bg-white'
                      }`}
                    >
                      {issue}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Describe the Problem */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Describe the Problem
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe any details about the leak, location of water valves, and what fixtures are affected..."
                className="w-full rounded-2xl border border-slate-200 p-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-200 h-28"
              />
            </div>

            {/* Upload Photos of the Issue (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Upload Photos of the Issue (Optional)
              </label>
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-[#FAFDFD] p-6 text-center cursor-pointer hover:border-teal-400 transition">
                <input type="file" onChange={handlePhotoUpload} className="hidden" accept="image/png, image/jpeg" />
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 mb-2 text-lg">
                  📷
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {uploadedPhotos.length > 0 ? uploadedPhotos.join(', ') : 'Drag photos here, or click to upload'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG up to 10MB</p>
              </label>
            </div>

            {/* Preferred Appointment Date & Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Preferred Appointment Date & Time
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <div className="relative">
                  <select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                    <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                    <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Specialist Profile & Cost Summary */}
          <div className="space-y-6">
            {/* Specialist Profile Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700 font-bold text-base overflow-hidden shrink-0 border border-slate-200">
                A
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Alex Rivera</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="text-amber-500 font-bold">⭐ 4.8</span>
                  <span>(194)</span>
                </div>
              </div>
            </div>

            {/* Cost Summary Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900">Cost Summary</h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>First Hour Diagnostic Rate</span>
                  <span className="font-bold text-slate-900">$85.00</span>
                </div>

                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Travel / Call-out Fee</span>
                  <span className="font-bold text-slate-900">$20.00</span>
                </div>

                <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                  <span className="font-bold text-slate-900">Est. Total Cost</span>
                  <span className="text-xl font-extrabold text-teal-600">$105.00</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                * The diagnostic fee is credited towards the final repair labor. Actual price may vary depending on parts and hours required.
              </p>

              <button
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                className="w-full rounded-2xl bg-teal-600 hover:bg-teal-700 py-3.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                {bookMutation.isPending ? 'Processing Booking…' : 'Confirm & Book Service'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
