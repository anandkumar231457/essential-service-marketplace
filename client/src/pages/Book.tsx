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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-800">Book {category || 'Service'}</h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {categoryId === undefined && (
            <p className="text-amber-600 text-sm mb-4">
              Could not resolve the service category. Please go back and select a category.
            </p>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12, 5th Block, Koramangala, Bengaluru"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending || !canBook}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {bookMutation.isPending ? 'Booking…' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}