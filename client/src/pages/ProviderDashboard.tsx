import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import BookingCard, { type HistoryBooking } from '../components/BookingCard';

// Web Audio API chime helper for incoming order notification
function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.24); // D6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function ProviderDashboard() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [available, setAvailable] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [realtimeAlert, setRealtimeAlert] = useState<{ message: string; category?: string } | null>(null);

  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Send Presence + GPS Coordinates to Backend (HTTP + Socket for double reliability)
  const sendPresencePing = useCallback(
    async (isOnline: boolean) => {
      if (!user?.id) return;
      try {
        let lat = 12.9716; // Bangalore fallback
        let lng = 77.5946;

        if (navigator.geolocation && isOnline) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                setLiveLocation({ lat, lng });
                resolve();
              },
              () => resolve(),
              { timeout: 5000, enableHighAccuracy: true }
            );
          });
        }

        // HTTP ping to persist to DB
        await api.post('/api/providers/ping', { lat, lng, isOnline });

        // Socket ping — this updates the in-memory presence map used for dispatch
        const socket = getSocket();
        if (socket.connected) {
          socket.emit('set-provider-id', user.id);
          if (isOnline) {
            // Emit both events: provider:online updates presence map, provider:location refreshes GPS
            socket.emit('provider:online', { providerId: user.id, lat, lng });
            socket.emit('provider:location', { providerId: user.id, lat, lng, isOnline: true });
          } else {
            socket.emit('provider:offline', { providerId: user.id });
          }
        }
      } catch {
        // ignore network glitches
      }
    },
    [user]
  );

  // 2. Presence Lifecycle: Refresh location every 20s while online
  useEffect(() => {
    if (available) {
      sendPresencePing(true);
      watchTimerRef.current = setInterval(() => {
        sendPresencePing(true);
      }, 20000);
    } else {
      sendPresencePing(false);
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    }

    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, [available, sendPresencePing]);

  // 3. Socket.io Real-Time Push Listener for Zomato/Swiggy Instant Dispatch
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      if (user?.id) {
        socket.emit('set-provider-id', user.id);
        if (available) {
          socket.emit('provider:online', { providerId: user.id, lat: liveLocation?.lat, lng: liveLocation?.lng });
        }
      }
    };

    const handleJobBroadcast = (data: { booking: HistoryBooking; radiusKm?: number; nearbyWorkersCount?: number }) => {
      // Play audio chime immediately
      playOrderChime();

      // Invalidate queries so React Query updates the open jobs instantly
      queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });

      // Show alert banner
      setRealtimeAlert({
        message: `🔔 New Order Dispatch: ${data.booking.category?.name || 'Service'} requested nearby (${data.booking.address})!`,
        category: data.booking.category?.name,
      });

      setTimeout(() => setRealtimeAlert(null), 8000);
    };

    const handleJobClaimed = (data: { bookingId: string; assignedTo: string; providerName?: string }) => {
      // If someone else claimed it, remove it immediately from our board
      if (data.assignedTo !== user?.id) {
        queryClient.setQueryData<{ bookings: HistoryBooking[] }>(['open-jobs'], (old) => {
          if (!old) return old;
          return {
            ...old,
            bookings: old.bookings.filter((b) => b.id !== data.bookingId),
          };
        });
        queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      }
    };

    const handleBookingStatusChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
    };

    socket.on('connect', handleConnect);
    socket.on('job:broadcast', handleJobBroadcast);
    socket.on('job:claimed', handleJobClaimed);
    socket.on('booking:status-changed', handleBookingStatusChanged);

    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('job:broadcast', handleJobBroadcast);
      socket.off('job:claimed', handleJobClaimed);
      socket.off('booking:status-changed', handleBookingStatusChanged);
    };
  }, [user, available, queryClient, liveLocation]);

  // 4. Data queries (with fast background refresh)
  const { data } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my'),
    refetchInterval: 5000,
  });

  const { data: openJobsData } = useQuery({
    queryKey: ['open-jobs'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/open'),
    refetchInterval: 3000,
  });

  const allBookings = data?.bookings ?? [];
  const requestedOrders = allBookings.filter((b) => b.status === 'REQUESTED');
  const activeJobs = allBookings.filter((b) => ['ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status));
  const completedJobs = allBookings.filter((b) => b.status === 'COMPLETED');
  const openJobs = openJobsData?.bookings ?? [];

  // 5. Mutation for advancing order lifecycle with atomic first-accept handling
  const advanceMutation = useMutation({
    mutationFn: async ({ endpoint, bookingId }: { endpoint: string; bookingId: string }) => {
      return api.post(`/api/bookings/${endpoint}`, { bookingId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      setActionError('');
      const actionName =
        variables.endpoint === 'accept'
          ? '🎉 Order Accepted! You are now assigned to this customer.'
          : variables.endpoint === 'en-route'
          ? '🚗 Status updated to En Route! Customer can see you traveling.'
          : variables.endpoint === 'in-progress'
          ? '🛠️ Service started! Timer & work in progress.'
          : variables.endpoint === 'complete'
          ? '✅ Job Completed successfully! Payout recorded.'
          : 'Order updated.';
      setActionSuccess(actionName);
      setTimeout(() => setActionSuccess(''), 4000);
    },
    onError: (err: any) => {
      // If order was already accepted by another specialist (409 Conflict)
      if (err?.status === 409 || err?.message?.includes('already accepted')) {
        setActionError('⚠️ Another specialist was faster! This order has already been claimed.');
        queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      } else {
        setActionError(err.message || 'Action failed');
      }
      setActionSuccess('');
    },
  });

  const toggleAvailability = async () => {
    const next = !available;
    setAvailable(next);
    await sendPresencePing(next);
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10 min-h-screen">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Header & Availability Toggle */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">PRO DISPATCH CONSOLE</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                <span className={`h-2 w-2 rounded-full ${available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {available ? 'Radar Active (Online)' : 'Radar Inactive (Offline)'}
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Pro'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Pick up incoming customer orders, manage active dispatches, and track earnings.
            </p>
          </div>

          <button
            onClick={toggleAvailability}
            className={`rounded-xl px-5 py-3 text-xs font-bold text-white transition shadow-md flex items-center gap-2 ${
              available ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="text-sm">{available ? '🟢' : '⚪'}</span>
            {available ? 'Online — Ready to Accept Orders' : 'Go Online to Receive Jobs'}
          </button>
        </div>

        {/* Real-time Order Arrival Banner */}
        {realtimeAlert && (
          <div className="rounded-2xl border-2 border-violet-400 bg-gradient-to-r from-violet-600 to-indigo-700 p-5 text-white shadow-xl animate-bounce flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="font-bold text-sm">{realtimeAlert.message}</p>
                <p className="text-xs text-violet-200">Tap Accept below to claim this job before other specialists!</p>
              </div>
            </div>
            <button
              onClick={() => setRealtimeAlert(null)}
              className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Notifications / Alerts */}
        {actionSuccess && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 animate-pulse flex items-center gap-2">
            <span>✓</span> {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
            <span>⚠️</span> {actionError}
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
            <p className="mt-2 text-4xl font-bold">{requestedOrders.length + openJobs.length}</p>
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

        {/* 0. OPEN BROADCAST JOB BOARD — Zomato/Swiggy Style Instant Dispatch */}
        {openJobs.length > 0 && (
          <section className="rounded-3xl border-2 border-violet-400 bg-violet-50/70 p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-600 text-white font-bold text-lg animate-bounce">
                  🛵
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Live Dispatch Radar — Open Orders Near You</h2>
                  <p className="text-xs text-slate-600">
                    Customers posted work orders — tap Accept to instantly claim the job!
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-violet-200 px-3.5 py-1 text-xs font-bold text-violet-900 animate-pulse">
                {openJobs.length} Live Order{openJobs.length > 1 ? 's' : ''} Available
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {openJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border-2 border-violet-200 bg-white p-5 shadow-md space-y-4 transition hover:border-violet-400"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                          {job.category?.name || 'Home Service'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">#{job.id.slice(-6)}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        Service Order from {job.customer?.name || 'Customer'}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                        <span>📍</span> <span className="font-medium">{job.address}</span>
                      </p>
                      {job.scheduledAt && (
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">
                          📅 Scheduled: {new Date(job.scheduledAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-emerald-600">₹500 / hr</p>
                      <p className="text-[11px] text-slate-400">Estimated Payout</p>
                    </div>
                  </div>

                  <div className="flex gap-3 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => advanceMutation.mutate({ endpoint: 'accept', bookingId: job.id })}
                      disabled={advanceMutation.isPending}
                      className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-xs font-bold text-white shadow-md transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>🛵 Accept & Claim This Job (First-Come)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 1. DIRECT INCOMING ORDERS SECTION (Assigned directly to this provider) */}
        {requestedOrders.length > 0 && (
          <section className="rounded-3xl border-2 border-amber-300 bg-amber-50/50 p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-white font-bold animate-bounce">
                  ⚡
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Direct Customer Bookings</h2>
                  <p className="text-xs text-slate-600">Customers selected you specifically for service</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                {requestedOrders.length} New Booking{requestedOrders.length > 1 ? 's' : ''}
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
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. ACTIVE IN-PROGRESS DISPATCHES (ACCEPTED, EN_ROUTE, IN_PROGRESS) */}
        {activeJobs.length > 0 && (
          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Active Live Dispatches ({activeJobs.length})</h2>
                <p className="text-xs text-slate-500">Live order progress controls — advance stages as you complete steps</p>
              </div>
            </div>

            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border-2 border-teal-200 bg-teal-50/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                          {job.category?.name || 'Service'}
                        </span>
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                          {job.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        Customer: {job.customer?.name || 'Client'} ({job.customer?.phone || 'No phone'})
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">📍 Service Location: {job.address}</p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        to={`/track/${job.id}`}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        🗺️ Open Live Map
                      </Link>
                    </div>
                  </div>

                  {/* Stage Advance Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/60">
                    {job.status === 'ACCEPTED' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'en-route', bookingId: job.id })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 rounded-xl bg-sky-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        🚗 Start Trip / En Route
                      </button>
                    )}

                    {job.status === 'EN_ROUTE' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'in-progress', bookingId: job.id })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 rounded-xl bg-amber-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        📍 Arrived at Customer Location (Start Service)
                      </button>
                    )}

                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'complete', bookingId: job.id })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        ✅ Complete Order & Collect Payment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Empty State when nothing is pending */}
        {openJobs.length === 0 && requestedOrders.length === 0 && activeJobs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <span className="text-4xl">📡</span>
            <h3 className="text-base font-bold text-slate-800">Dispatch Radar Active</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Listening for new customer service requests nearby. When a customer books or posts a job, it will pop up here instantly via live push!
            </p>
          </div>
        )}

        {/* 4. Completed Order History */}
        {completedJobs.length > 0 && (
          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">All Completed & Past Orders</h2>
                <p className="text-xs text-slate-500">Historical records of finished customer jobs</p>
              </div>
              <Link to="/history" className="text-xs font-bold text-primary hover:underline">
                View All History
              </Link>
            </div>

            <div className="space-y-3">
              {completedJobs.slice(0, 5).map((booking) => (
                <BookingCard key={booking.id} booking={booking} isProviderView={true} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
