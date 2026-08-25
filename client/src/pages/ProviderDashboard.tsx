import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import BookingCard, { type HistoryBooking } from '../components/BookingCard';

// Haversine distance helper for client-side comparison
function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

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
  
  // Live GPS tracking state
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'tracking' | 'searching' | 'denied'>('searching');
  const [lastGpsSync, setLastGpsSync] = useState<Date>(new Date());
  
  // Real-time dispatch alert state
  const [realtimeAlert, setRealtimeAlert] = useState<{
    bookingId: string;
    message: string;
    category?: string;
    distanceKm?: number;
    address?: string;
  } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Send Presence + GPS Coordinates to Backend
  const syncLocation = useCallback(
    async (coords: { lat: number; lng: number; accuracy?: number }, isOnline: boolean) => {
      if (!user?.id) return;
      try {
        setLiveLocation(coords);
        setLastGpsSync(new Date());

        // HTTP ping to persist to database
        await api.post('/api/providers/ping', {
          lat: coords.lat,
          lng: coords.lng,
          isOnline,
        });

        // Socket emit to keep in-memory presence map active
        const socket = getSocket();
        if (socket.connected) {
          socket.emit('set-provider-id', user.id);
          if (isOnline) {
            socket.emit('provider:online', { providerId: user.id, lat: coords.lat, lng: coords.lng });
            socket.emit('provider:location', { providerId: user.id, lat: coords.lat, lng: coords.lng, isOnline: true });
          } else {
            socket.emit('provider:offline', { providerId: user.id });
          }
        }
      } catch {
        // ignore background glitches
      }
    },
    [user]
  );

  // 2. Active GPS Watcher: Uses navigator.geolocation.watchPosition for continuous high accuracy
  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    setGpsStatus('searching');

    // First do an immediate getCurrentPosition
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setGpsStatus('tracking');
        syncLocation(coords, available);
      },
      () => {
        setGpsStatus('denied');
        // Fallback default coordinates if denied
        const fallback = { lat: 12.9352, lng: 77.6245, accuracy: 50 };
        syncLocation(fallback, available);
      },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
    );

    // Then start continuous watchPosition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setGpsStatus('tracking');
        syncLocation(coords, available);
      },
      (err) => {
        console.warn('GPS watch warning:', err.message);
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [available, syncLocation]);

  // 3. Presence Lifecycle: Refresh GPS on mount and start periodic background sync
  useEffect(() => {
    startGpsTracking();

    // Background interval to refresh DB ping every 20 seconds
    pingIntervalRef.current = setInterval(() => {
      if (liveLocation) {
        syncLocation(liveLocation, available);
      }
    }, 20000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [available, startGpsTracking, syncLocation, liveLocation]);

  // 4. Socket.io Real-Time Push Listener for Zomato/Swiggy Instant Dispatch
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      if (user?.id) {
        socket.emit('set-provider-id', user.id);
        if (available && liveLocation) {
          socket.emit('provider:online', { providerId: user.id, lat: liveLocation.lat, lng: liveLocation.lng });
        }
      }
    };

    const handleJobBroadcast = (data: { booking: HistoryBooking; radiusKm?: number; distanceKm?: number }) => {
      // Play audio chime
      playOrderChime();

      // Compare GPS distance
      let dist = data.distanceKm;
      if (!dist && liveLocation && data.booking?.lat && data.booking?.lng) {
        dist = calculateDistanceKm(liveLocation.lat, liveLocation.lng, data.booking.lat, data.booking.lng);
      }

      // Invalidate queries so open jobs list updates instantly
      queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });

      // Show alert banner with exact distance
      setRealtimeAlert({
        bookingId: data.booking.id,
        message: `🔔 New Order Dispatch: ${data.booking.category?.name || 'Service'} requested!`,
        category: data.booking.category?.name,
        distanceKm: dist,
        address: data.booking.address,
      });

      // Auto dismiss after 12 seconds
      setTimeout(() => setRealtimeAlert(null), 12000);
    };

    const handleJobClaimed = (data: { bookingId: string; assignedTo: string; providerName?: string }) => {
      // If someone else claimed it, remove it immediately from our open jobs
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

  // 5. Data queries (with fast background refresh & sending live GPS)
  const { data } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my'),
    refetchInterval: 5000,
  });

  const { data: openJobsData } = useQuery({
    queryKey: ['open-jobs', liveLocation?.lat, liveLocation?.lng],
    queryFn: () => {
      const params = liveLocation ? `?lat=${liveLocation.lat}&lng=${liveLocation.lng}` : '';
      return api.get<{ bookings: (HistoryBooking & { distanceKm?: number })[] }>(`/api/bookings/open${params}`);
    },
    refetchInterval: 3000,
  });

  const allBookings = data?.bookings ?? [];
  const requestedOrders = allBookings.filter((b) => b.status === 'REQUESTED');
  const activeJobs = allBookings.filter((b) => ['ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(b.status));
  const completedJobs = allBookings.filter((b) => b.status === 'COMPLETED');

  // Compute live distances for open jobs relative to provider's current GPS
  const openJobs = (openJobsData?.bookings ?? []).map((job) => {
    let dist = job.distanceKm;
    if (dist === undefined && liveLocation && job.lat && job.lng) {
      dist = calculateDistanceKm(liveLocation.lat, liveLocation.lng, job.lat, job.lng);
    }
    return { ...job, computedDistanceKm: dist };
  }).sort((a, b) => (a.computedDistanceKm ?? 999) - (b.computedDistanceKm ?? 999));

  // 6. Mutation for advancing order lifecycle with atomic first-accept handling
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
          ? '🎉 Order Accepted & Claimed! You are assigned to this job.'
          : variables.endpoint === 'en-route'
          ? '🚗 Status: En Route. Customer notified.'
          : variables.endpoint === 'in-progress'
          ? '🛠️ Service Started! Work in progress.'
          : variables.endpoint === 'complete'
          ? '✅ Job Completed Successfully! Payout recorded.'
          : 'Order updated.';
      setActionSuccess(actionName);
      setTimeout(() => setActionSuccess(''), 4000);
    },
    onError: (err: any) => {
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
    if (liveLocation) {
      await syncLocation(liveLocation, next);
    }
  };

  return (
    <div className="bg-[#f7fafb] px-4 py-8 sm:px-6 lg:px-8 pb-20 md:pb-10 min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Header & Availability Toggle */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">SPECIALIST DISPATCH RADAR</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                <span className={`h-2 w-2 rounded-full ${available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {available ? 'Radar Active (Online)' : 'Radar Inactive (Offline)'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Pro'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Active GPS matches incoming customer orders within your area in real-time.
            </p>
          </div>

          <button
            onClick={toggleAvailability}
            className={`rounded-2xl px-5 py-3 text-xs font-bold text-white transition shadow-md flex items-center gap-2 ${
              available ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="text-sm">{available ? '🟢' : '⚪'}</span>
            {available ? 'Online — Receiving Nearby Orders' : 'Go Online to Receive Orders'}
          </button>
        </div>

        {/* 🛰️ ACTIVE LIVE GPS RADAR BAR */}
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-600 text-white font-bold text-lg shadow-sm">
              🛰️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Active Device GPS Tracking
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  gpsStatus === 'tracking' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {gpsStatus === 'tracking' ? '🟢 Live GPS Active' : '⏳ Acquiring Coords'}
                </span>
              </div>

              {liveLocation ? (
                <p className="text-xs text-slate-600 mt-0.5 font-mono">
                  Coordinates: <span className="font-semibold text-slate-900">{liveLocation.lat.toFixed(5)}, {liveLocation.lng.toFixed(5)}</span>
                  {liveLocation.accuracy && <span className="text-slate-400"> (±{liveLocation.accuracy}m)</span>}
                  <span className="text-slate-400 ml-2">Synced: {lastGpsSync.toLocaleTimeString()}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">Detecting continuous GPS location from your browser…</p>
              )}
            </div>
          </div>

          <button
            onClick={startGpsTracking}
            className="shrink-0 rounded-xl bg-white border border-teal-200 hover:border-teal-400 px-3.5 py-2 text-xs font-bold text-teal-800 shadow-sm transition hover:bg-teal-50 flex items-center gap-1.5 justify-center"
          >
            🔄 Refresh GPS Location
          </button>
        </div>

        {/* Real-time Order Arrival Banner */}
        {realtimeAlert && (
          <div className="rounded-3xl border-2 border-violet-500 bg-gradient-to-r from-violet-600 to-indigo-700 p-5 text-white shadow-2xl animate-bounce flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔔</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                    New Order Alert
                  </span>
                  {realtimeAlert.distanceKm !== undefined && (
                    <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-950">
                      📍 {realtimeAlert.distanceKm} km away from your GPS
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm sm:text-base mt-1">{realtimeAlert.message}</p>
                <p className="text-xs text-violet-200 font-medium">
                  {realtimeAlert.address || 'Customer waiting nearby'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  advanceMutation.mutate({ endpoint: 'accept', bookingId: realtimeAlert.bookingId });
                  setRealtimeAlert(null);
                }}
                className="rounded-xl bg-emerald-400 hover:bg-emerald-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-md transition"
              >
                ⚡ Accept Now
              </button>
              <button
                onClick={() => setRealtimeAlert(null)}
                className="rounded-xl bg-white/20 hover:bg-white/30 px-3 py-2.5 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Action Notifications / Alerts */}
        {actionSuccess && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 animate-pulse flex items-center gap-2">
            <span>✓</span> {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
            <span>⚠️</span> {actionError}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-amber-500 p-5 text-white shadow-sm">
            <p className="text-xs font-bold text-amber-100 uppercase tracking-wide">Available Nearby Jobs</p>
            <p className="mt-2 text-3xl font-extrabold">{openJobs.length + requestedOrders.length}</p>
            <p className="mt-1 text-xs text-amber-100">Ready to accept right now</p>
          </div>

          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Active In-Progress Jobs</p>
            <p className="mt-2 text-3xl font-extrabold">{activeJobs.length}</p>
            <p className="mt-1 text-xs text-teal-300">En route or work underway</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Completed Orders</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{completedJobs.length}</p>
            <p className="mt-1 text-xs text-slate-400">Total lifetime jobs finished</p>
          </div>
        </div>

        {/* 0. OPEN BROADCAST JOB BOARD — Zomato/Swiggy Style Instant Dispatch */}
        {openJobs.length > 0 ? (
          <section className="rounded-3xl border-2 border-violet-400 bg-violet-50/70 p-5 sm:p-6 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-white font-bold text-lg animate-bounce">
                  🛵
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Live Dispatch Radar — Open Orders Near Your GPS
                  </h2>
                  <p className="text-xs text-slate-600">
                    Calculated distance from your live device coordinates. Tap Accept to claim the job!
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-violet-200 px-3.5 py-1 text-xs font-bold text-violet-900 animate-pulse self-start sm:self-center">
                {openJobs.length} Live Order{openJobs.length > 1 ? 's' : ''} Ready
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {openJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border-2 border-violet-200 bg-white p-5 shadow-md space-y-4 transition hover:border-violet-400"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                          {job.category?.name || 'Home Service'}
                        </span>
                        {job.computedDistanceKm !== undefined && (
                          <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold flex items-center gap-1 ${
                            job.computedDistanceKm <= 3
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-teal-100 text-teal-800 border border-teal-200'
                          }`}>
                            📍 {job.computedDistanceKm} km away from your GPS
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-400">#{job.id.slice(-6)}</span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">
                        Service Order from {job.customer?.name || 'Customer'}
                      </h3>
                      
                      <p className="text-xs text-slate-700 font-medium flex items-center gap-1">
                        <span>📍 Location:</span> <span>{job.address}</span>
                      </p>

                      {job.description && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{job.description}"
                        </p>
                      )}

                      {job.scheduledAt && (
                        <p className="text-[11px] text-slate-600 font-semibold">
                          📅 Scheduled For: {new Date(job.scheduledAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl font-extrabold text-emerald-600">₹500 / hr</p>
                      <p className="text-[11px] text-slate-400">Estimated Payout</p>
                    </div>
                  </div>

                  <div className="flex gap-3 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => advanceMutation.mutate({ endpoint: 'accept', bookingId: job.id })}
                      disabled={advanceMutation.isPending}
                      className="w-full rounded-xl bg-teal-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>🛵</span> Accept & Claim This Job (First-Accept-Wins)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center space-y-2">
            <div className="text-3xl">📡</div>
            <h3 className="font-bold text-slate-800 text-sm">GPS Dispatch Radar is Active</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Scanning for new customer requests nearby. When a customer posts a job matching your GPS location, it will ring and appear here instantly!
            </p>
          </section>
        )}

        {/* 1. Direct Requested Orders Assigned to You */}
        {requestedOrders.length > 0 && (
          <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Direct Customer Bookings</h2>
                <p className="text-xs text-slate-500">Customers selected you directly for these jobs.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {requestedOrders.length} Direct Request{requestedOrders.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid gap-4">
              {requestedOrders.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {booking.category?.name}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">{booking.customer?.name}</h3>
                      <p className="text-xs text-slate-500">📍 {booking.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => advanceMutation.mutate({ endpoint: 'accept', bookingId: booking.id })}
                      className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
                    >
                      Accept Booking
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. Active Orders in Progress */}
        {activeJobs.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Active Dispatches in Progress</h2>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-slate-100 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                          {job.status.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-slate-900">{job.category?.name}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">Customer: <span className="font-semibold">{job.customer?.name}</span> ({job.customer?.phone || 'No phone'})</p>
                      <p className="text-xs text-slate-600">📍 {job.address}</p>
                    </div>
                    <Link
                      to={`/track/${job.id}`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 text-center"
                    >
                      🗺️ Open Live Map Tracker
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {job.status === 'ACCEPTED' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'en-route', bookingId: job.id })}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white"
                      >
                        🚗 Start Travel (En Route)
                      </button>
                    )}
                    {job.status === 'EN_ROUTE' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'in-progress', bookingId: job.id })}
                        className="rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white"
                      >
                        🛠️ Arrived & Start Work (In Progress)
                      </button>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => advanceMutation.mutate({ endpoint: 'complete', bookingId: job.id })}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
                      >
                        ✅ Finish & Complete Job
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Completed Jobs History */}
        {completedJobs.length > 0 && (
          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Completed Orders History</h2>
            <div className="space-y-3">
              {completedJobs.slice(0, 5).map((booking) => (
                <BookingCard key={booking.id} booking={booking} isProviderView />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
