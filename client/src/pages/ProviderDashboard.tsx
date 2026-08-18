import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import BookingCard, { type HistoryBooking } from '../components/BookingCard';

export default function ProviderDashboard() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [available, setAvailable] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my'),
    refetchInterval: 5000, // Poll every 5 seconds for new incoming orders
  });

  const allBookings = data?.bookings ?? [];
  const requestedOrders = allBookings.filter((b) => b.status === 'REQUESTED');
  const activeJobs = allBookings.filter((b) => ['ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status));
  const completedJobs = allBookings.filter((b) => b.status === 'COMPLETED');

  // Mutation for advancing order lifecycle
  const advanceMutation = useMutation({
    mutationFn: async ({ endpoint, bookingId }: { endpoint: string; bookingId: string }) => {
      return api.post(`/api/bookings/${endpoint}`, { bookingId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setActionError('');
      const actionName =
        variables.endpoint === 'accept'
          ? 'Order Accepted! You are now assigned to this customer.'
          : variables.endpoint === 'en-route'
          ? 'Status updated to En Route! Customer can see you traveling.'
          : variables.endpoint === 'in-progress'
          ? 'Service started! Timer & work in progress.'
          : variables.endpoint === 'complete'
          ? 'Job Completed successfully! Payout recorded.'
          : 'Order updated.';
      setActionSuccess(actionName);
      setTimeout(() => setActionSuccess(''), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Action failed');
      setActionSuccess('');
    },
  });

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
        {/* Top Header & Availability Toggle */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">PRO DISPATCH CONSOLE</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Pro'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">Pick up incoming customer orders, manage active dispatches, and track earnings.</p>
          </div>

          <button
            onClick={() => void setAvailability()}
            className={`rounded-xl px-5 py-2.5 text-xs font-semibold text-white transition shadow-sm ${
              available ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600'
            }`}
          >
            {available ? '● Online & Accepting Orders' : '○ Offline (Not Receiving Orders)'}
          </button>
        </div>

        {/* Notifications / Alerts */}
        {actionSuccess && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 animate-pulse">
            ✓ {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800">
            {actionError}
          </div>
        )}

        {/* Console Quick Nav Buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/provider/services"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-teal-200 hover:text-primary transition"
          >
            🛠️ Trade Category, Skills & Rates
          </Link>
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
          <div className="rounded-2xl bg-amber-500 p-6 text-white shadow-sm">
            <p className="text-xs font-medium text-amber-100 uppercase tracking-wide">Pending Customer Requests</p>
            <p className="mt-2 text-4xl font-bold">{requestedOrders.length}</p>
            <p className="mt-2 text-xs text-amber-100">Ready to accept & pick up</p>
          </div>

          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Active In-Progress Jobs</p>
            <p className="mt-2 text-4xl font-bold">{activeJobs.length}</p>
            <p className="mt-2 text-xs text-teal-300">En route or work underway</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Completed Orders</p>
            <p className="mt-2 text-4xl font-bold text-slate-900">{completedJobs.length}</p>
            <p className="mt-2 text-xs text-slate-400">Total lifetime jobs finished</p>
          </div>
        </div>

        {/* 1. SWIGGY-STYLE INCOMING ORDERS SECTION */}
        {requestedOrders.length > 0 && (
          <section className="rounded-3xl border-2 border-amber-300 bg-amber-50/50 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-white font-bold animate-bounce">
                  ⚡
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Incoming Orders — Pick Up Available</h2>
                  <p className="text-xs text-slate-600">Customers waiting for service dispatch nearby</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                {requestedOrders.length} New Request{requestedOrders.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {requestedOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        {order.category?.name || 'Home Repair'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        Service Order from {order.customer?.name || 'Customer'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">📍 {order.address}</p>
                      {order.scheduledAt && (
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">
                          📅 Scheduled: {new Date(order.scheduledAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">₹500 / hr</p>
                      <p className="text-[11px] text-slate-400">Standard Payout</p>
                    </div>
                  </div>

                  {/* Accept / Decline Action Controls */}
                  <div className="flex gap-3 border-t border-slate-100 pt-4">
                    <button
                      onClick={() => advanceMutation.mutate({ endpoint: 'accept', bookingId: order.id })}
                      disabled={advanceMutation.isPending}
                      className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>⚡ Accept Order & Pick Up</span>
                    </button>
                    <button
                      onClick={() => advanceMutation.mutate({ endpoint: 'cancel', bookingId: order.id })}
                      disabled={advanceMutation.isPending}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. ACTIVE ORDERS IN-PROGRESS (SWIGGY DRIVER PIPELINE) */}
        {activeJobs.length > 0 && (
          <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Active Jobs in Progress</h2>
                <p className="text-xs text-slate-500">Advance order stages as you travel and complete the repair</p>
              </div>
            </div>

            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">
                          {job.category?.name || 'Service Order'}
                        </span>
                        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-primary border border-teal-200">
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">📍 {job.address}</p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">
                        Client: {job.customer?.name || 'Customer'}
                      </p>
                    </div>

                    <Link
                      to={`/track/${job.id}`}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center"
                    >
                      Open Live GPS Track →
                    </Link>
                  </div>

                  {/* Stage-by-Stage Buttons */}
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {job.status === 'ACCEPTED' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'en-route', bookingId: job.id })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700"
                      >
                        🚗 Start Trip / En Route to Customer
                      </button>
                    )}

                    {job.status === 'EN_ROUTE' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'in-progress', bookingId: job.id })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white transition hover:bg-orange-700"
                      >
                        📍 Arrived at Customer / Start Work
                      </button>
                    )}

                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'complete', bookingId: job.id })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                      >
                        ✅ Work Done / Complete Order
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. ALL JOB HISTORY LIST */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">All Completed & Past Orders</h2>
              <p className="text-xs text-slate-500">Historical records of finished customer jobs</p>
            </div>
            <Link to="/history" className="text-xs font-semibold text-primary hover:underline">
              View All History
            </Link>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-500">Loading order records…</p>
          ) : allBookings.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-8 text-center text-xs text-slate-500">
              No orders received yet. Make sure your status is toggled Online to receive nearby requests!
            </div>
          ) : (
            <div className="space-y-3">
              {allBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isProviderView />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
