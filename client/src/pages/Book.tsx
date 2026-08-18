import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Booking, ServiceCategory } from '../types';
import DatePicker from '../components/DatePicker';
import TimeSlotPicker from '../components/TimeSlotPicker';

export default function Book() {
  const { providerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') ?? '';

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(12.9352); // Koramangala default
  const [lng, setLng] = useState(77.6245);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM - 10:00 AM');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Resolve categoryId
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  const categoryId = categoriesData?.categories.find(
    (c) => c.name.toLowerCase() === category.toLowerCase(),
  )?.id;

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post<{ booking: Booking }>('/api/bookings/request', {
        providerId,
        categoryId,
        address,
        lat,
        lng,
        scheduledAt: new Date(selectedDate).toISOString(),
      }),
    onSuccess: (data) => {
      navigate(`/booking/${data.booking.id}/confirmed`);
    },
    onError: (err: any) => setError(err.message || 'Booking failed'),
  });

  const canBook = Boolean(address) && categoryId !== undefined;

  return (
    <div className="bg-[#f7fafb] py-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-3xl px-5">
        <button onClick={() => navigate(-1)} className="text-xs font-semibold text-primary hover:underline mb-4">
          ← Back
        </button>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              {category || 'HOME REPAIR'} SERVICE
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Schedule Repair Service</h1>
            <p className="mt-1 text-xs text-slate-500">
              Select date, time, and service location details for your booking.
            </p>
          </div>

          {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 border border-rose-200">{error}</p>}

          {categoryId === undefined && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 border border-amber-200">
              Could not resolve the service category. Please go back and select a category.
            </p>
          )}

          {/* Date Picker */}
          <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          {/* Time Slot Picker */}
          <TimeSlotPicker selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />

          {/* Address & Location Inputs */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                Job Notes / Details (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the issue (e.g. Water leak under kitchen sink)..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 h-20"
              />
            </div>
          </div>

          {/* Pricing & Submit */}
          <div className="rounded-2xl bg-slate-50 p-4 flex justify-between items-center text-xs">
            <div>
              <p className="text-slate-500 font-medium">Estimated Rate</p>
              <p className="text-lg font-bold text-slate-900">₹500 / hr</p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-[200px] text-right">
              Final price confirmed by specialist upon arrival.
            </p>
          </div>

          <button
            onClick={() => bookMutation.mutate()}
            disabled={bookMutation.isPending || !canBook}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {bookMutation.isPending ? 'Submitting Request…' : 'Confirm & Request Specialist'}
          </button>
        </div>
      </div>
    </div>
  );
}
