import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../lib/api';
import BookingCard, { type HistoryBooking } from '../components/BookingCard';

export default function History() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my'),
  });

  const filteredBookings = useMemo(() => {
    if (!data?.bookings) return [];
    if (activeTab === 'ACTIVE') {
      return data.bookings.filter((b) => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status));
    }
    if (activeTab === 'COMPLETED') {
      return data.bookings.filter((b) => b.status === 'COMPLETED');
    }
    if (activeTab === 'CANCELLED') {
      return data.bookings.filter((b) => ['CANCELLED', 'REJECTED'].includes(b.status));
    }
    return data.bookings;
  }, [data, activeTab]);

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-primary">YOUR ACTIVITY</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Booking History</h1>
        <p className="mt-2 text-slate-500">Every service request and trackable job in one place.</p>

        {/* Status Filter Tabs */}
        <div className="mt-6 flex border-b border-slate-200 gap-6 text-xs font-bold uppercase tracking-wider">
          {(['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 transition ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab} {data?.bookings && `(${
                tab === 'ALL'
                  ? data.bookings.length
                  : tab === 'ACTIVE'
                  ? data.bookings.filter((b) => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status)).length
                  : tab === 'COMPLETED'
                  ? data.bookings.filter((b) => b.status === 'COMPLETED').length
                  : data.bookings.filter((b) => ['CANCELLED', 'REJECTED'].includes(b.status)).length
              })`}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {isLoading && <p className="text-slate-500 text-sm">Loading bookings…</p>}
          {error && <p className="text-red-600 text-sm">{(error as Error).message}</p>}

          {!isLoading && filteredBookings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500 text-sm">
              No bookings found for this filter.
            </div>
          )}

          {filteredBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      </div>
    </div>
  );
}
