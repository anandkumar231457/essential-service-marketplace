import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Booking, ServiceCategory } from '../types';

export default function Book() {
  const { providerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') ?? '';

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(12.9352); // Koramangala default
  const [lng, setLng] = useState(77.6245);
  const [error, setError] = useState('');

  // Resolve the real categoryId from the category name/slug instead of
  // hardcoding a placeholder. The category name comes from the URL query
  // param (e.g. /book/:providerId?category=Electrician).
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
      }),
    onSuccess: (data) => {
      navigate(`/track/${data.booking.id}`);
    },
    onError: (err: any) => setError(err.message || 'Booking failed'),
  });

  const canBook = Boolean(address) && categoryId !== undefined;

  return (
    <div className="bg-[#f7fafb] py-8">
      <header className="mx-auto max-w-2xl px-5">
        <div className="flex items-center justify-between py-4">
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-slate-800">Schedule repair service</h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-primary">{category || 'HOME SERVICE'}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Tell us where you need help</h2>
          <p className="mt-2 text-sm text-slate-500">We’ll send your request to the selected specialist.</p>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {categoryId === undefined && (
            <p className="text-amber-600 text-sm mb-4">
              Could not resolve the service category. Please go back and select a category.
            </p>
          )}
          <div className="mt-7 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12, 5th Block, Koramangala, Bengaluru"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>
            <button
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending || !canBook}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {bookMutation.isPending ? 'Booking…' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
