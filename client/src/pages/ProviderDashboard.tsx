import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import BookingCard, { type HistoryBooking } from '../components/BookingCard';

export default function ProviderDashboard() {
  const user = useAuthStore((state) => state.user);
  const [available, setAvailable] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my'),
  });

  const active = data?.bookings.filter((booking) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(booking.status)) ?? [];

  const setAvailability = async () => {
    const next = !available;
    try {
      await api.post('/api/providers/ping', { lat: 12.9352, lng: 77.6245, isOnline: next });
    } catch {
      // ignore mock ping
    }
    setAvailable(next);
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">PRO CONSOLE</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Pro'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">Manage jobs, update availability, and track earnings.</p>
          </div>

          <button
            onClick={() => void setAvailability()}
            className={`rounded-xl px-5 py-2.5 text-xs font-semibold text-white transition ${
              available ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600'
            }`}
          >
            {available ? '● You’re Available' : '○ You’re Offline'}
          </button>
        </div>

        {/* Console Quick Nav Buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/provider/earnings"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-teal-200 hover:text-primary transition"
          >
            💰 Earnings Breakdown
          </Link>
          <Link
            to="/provider/availability"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-teal-200 hover:text-primary transition"
          >
            ⏰ Shift & Availability
          </Link>
          <Link
            to="/provider/coverage"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-teal-200 hover:text-primary transition"
          >
            🗺️ Service Radius Area
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-medium text-slate-400">Active Jobs Queue</p>
            <p className="mt-2 text-4xl font-bold">{active.length}</p>
            <p className="mt-2 text-xs text-teal-300">Ready for dispatch or in progress</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">New Pending Requests</p>
            <p className="mt-2 text-4xl font-bold text-slate-900">
              {data?.bookings.filter((b) => b.status === 'REQUESTED').length ?? 0}
            </p>
            <p className="mt-2 text-xs text-primary">Review & respond quickly</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Completed Jobs</p>
            <p className="mt-2 text-4xl font-bold text-slate-900">
              {data?.bookings.filter((b) => b.status === 'COMPLETED').length ?? 0}
            </p>
            <p className="mt-2 text-xs text-slate-400">Work history saved</p>
          </div>
        </div>

        {/* Job Queue List */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Work Requests</h2>
              <p className="text-xs text-slate-500">Respond to incoming customers or update active job status.</p>
            </div>
            <Link to="/history" className="text-xs font-semibold text-primary hover:underline">
              View All History
            </Link>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-500">Loading work queue…</p>
          ) : active.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-8 text-center text-xs text-slate-500">
              No active jobs in your queue right now. New requests will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isProviderView />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
