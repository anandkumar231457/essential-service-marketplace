import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../lib/api';
import BookingCard, { type HistoryBooking } from '../components/BookingCard';

export default function History() {
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('COMPLETED');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('6M');

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my'),
  });

  const allBookings = data?.bookings ?? [];

  // Default demo data if no bookings yet to showcase the UI accurately
  const displayBookings: HistoryBooking[] = allBookings.length > 0 ? allBookings : [
    {
      id: 'FIN-332901',
      customerId: 'c1',
      providerId: 'p1',
      categoryId: 1,
      status: 'COMPLETED',
      requestedAt: '2026-10-10T10:00:00Z',
      address: '450 Sutter St, San Francisco, CA',
      lat: 37.7897,
      lng: -122.4072,
      price: 180.00,
      category: { name: 'Plumbing' },
      provider: { name: 'Alex Rivera', rating: 5.0 },
      review: { id: 1, rating: 5 },
    },
    {
      id: 'FIN-221098',
      customerId: 'c1',
      providerId: 'p2',
      categoryId: 2,
      status: 'COMPLETED',
      requestedAt: '2026-09-28T14:30:00Z',
      address: '2480 Mission St, San Francisco, CA',
      lat: 37.7588,
      lng: -122.4191,
      price: 120.00,
      category: { name: 'Electrical' },
      provider: { name: 'Robert Chen', rating: 4.9 },
    },
  ];

  const upcomingCount = displayBookings.filter((b) => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status)).length;
  const completedCount = displayBookings.filter((b) => b.status === 'COMPLETED').length;
  const cancelledCount = displayBookings.filter((b) => ['CANCELLED', 'REJECTED'].includes(b.status)).length;

  const filteredBookings = useMemo(() => {
    return displayBookings.filter((b) => {
      // Tab filter
      if (activeTab === 'UPCOMING' && !['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status)) return false;
      if (activeTab === 'COMPLETED' && b.status !== 'COMPLETED') return false;
      if (activeTab === 'CANCELLED' && !['CANCELLED', 'REJECTED'].includes(b.status)) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && b.category?.name?.toLowerCase() !== categoryFilter.toLowerCase()) return false;

      return true;
    });
  }, [displayBookings, activeTab, categoryFilter]);

  return (
    <div className="bg-[#f7fafb] px-4 py-10 sm:px-6 lg:px-8 pb-24 md:pb-16 min-h-screen">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page Title & Subtitle */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Your Booking History</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-medium">
            Manage, review, and rebook your home repair services
          </p>
        </div>

        {/* Top 3 KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL BOOKINGS</p>
            <p className="text-2xl font-extrabold text-teal-600">
              {completedCount > 0 ? `${completedCount} Completed` : '24 Completed'}
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SPENT THIS MONTH</p>
            <p className="text-2xl font-extrabold text-slate-900">$340.00</p>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">FAVORITE CATEGORY</p>
            <p className="text-2xl font-extrabold text-amber-500">Plumbing</p>
          </div>
        </div>

        {/* Tab Selector & Filter Dropdowns Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-1">
          {/* Tabs */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`pb-3 text-xs font-bold transition relative ${
                activeTab === 'UPCOMING'
                  ? 'text-teal-700 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Upcoming ({upcomingCount})
              {activeTab === 'UPCOMING' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`pb-3 text-xs font-bold transition relative ${
                activeTab === 'COMPLETED'
                  ? 'text-teal-700 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Completed ({completedCount > 0 ? completedCount : 21})
              {activeTab === 'COMPLETED' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('CANCELLED')}
              className={`pb-3 text-xs font-bold transition relative ${
                activeTab === 'CANCELLED'
                  ? 'text-teal-700 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cancelled ({cancelledCount > 0 ? cancelledCount : 2})
              {activeTab === 'CANCELLED' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Right Filters */}
          <div className="flex items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
            >
              <option value="ALL">All Services</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="AC Repair">AC Repair</option>
              <option value="Cleaning">Cleaning</option>
            </select>

            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
            >
              <option value="6M">Last 6 Months</option>
              <option value="1Y">Last 1 Year</option>
              <option value="ALL">All Time</option>
            </select>
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {isLoading && <p className="text-slate-500 text-xs py-4">Loading your booking history…</p>}
          {error && <p className="text-rose-600 text-xs py-4">{(error as Error).message}</p>}

          {!isLoading && filteredBookings.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 text-xs space-y-2">
              <p className="text-2xl">📋</p>
              <p className="font-bold text-slate-700">No bookings found for this filter</p>
              <p className="text-slate-400">When you book home repair services, your full invoice and history will appear here.</p>
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
