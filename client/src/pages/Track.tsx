import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import type { Booking } from '../types';
import StatusBadge from '../components/StatusBadge';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// Custom Swiggy/Zomato style map icons
const customerMarkerIcon = L.divIcon({
  className: 'custom-customer-icon',
  html: `<div style="background:#0f172a;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const nearbyProMarkerIcon = L.divIcon({
  className: 'custom-pro-icon',
  html: `<div style="background:#0d9488;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(13,148,136,0.5);">🛵</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const assignedProMarkerIcon = L.divIcon({
  className: 'custom-assigned-icon',
  html: `<div style="background:#10b981;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #0f172a;box-shadow:0 4px 12px rgba(16,185,129,0.6);">🚗</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});


interface ProviderStatus {
  providerId: string;
  isOnline: boolean;
  lat?: number;
  lng?: number;
  lastSeen?: string;
}

const STEPS = ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];

const STEP_LABELS: Record<string, string> = {
  REQUESTED: 'Finding Specialist',
  ACCEPTED: 'Order Accepted',
  EN_ROUTE: 'Specialist En Route',
  IN_PROGRESS: 'Service Underway',
  COMPLETED: 'Service Finished',
};

export default function Track() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [booking, setBooking] = useState<
    | (Booking & {
        provider?: { id?: string; name: string; phone: string };
        customer?: { name: string; phone: string };
        category?: { name: string };
      })
    | null
  >(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [nearbyPros, setNearbyPros] = useState<Array<{
    providerId: string;
    name: string;
    phone?: string;
    category: string;
    lat: number;
    lng: number;
    isOnline: boolean;
    distanceKm: string | number;
  }>>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Re-broadcast and Search Radius expansion state
  const [searchRadius, setSearchRadius] = useState(5);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    try {
      const data = await api.get<{
        booking: Booking & {
          provider?: { id?: string; name: string; phone: string };
          customer?: { name: string; phone: string };
          category?: { name: string };
        };
      }>(`/api/bookings/${bookingId}`);
      setBooking(data.booking);

      if (data.booking.providerId) {
        const status = await api.get<ProviderStatus>(`/api/providers/${data.booking.providerId}/status`);
        setProviderStatus(status);
      } else if (data.booking.status === 'REQUESTED' && data.booking.lat && data.booking.lng) {
        // Fetch nearby active online providers (Swiggy/Zomato style map visibility)
        try {
          const res = await api.get<{ providers: any[] }>(
            `/api/providers/nearby?lat=${data.booking.lat}&lng=${data.booking.lng}&radiusKm=50&onlineOnly=true`
          );
          setNearbyPros(res.providers || []);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Socket.io live listener
  useEffect(() => {
    if (!bookingId) return;
    const socket = getSocket();

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('join-booking-room', bookingId);
    };

    const handleDisconnect = () => setSocketConnected(false);

    const handleLocationUpdate = (data: ProviderStatus) => {
      setProviderStatus(data);
    };

    const handleStatusUpdate = (data: { status: string; provider?: any }) => {
      setStatusMessage(`✓ Status changed to ${data.status}!`);
      fetchBooking();
      setTimeout(() => setStatusMessage(''), 4000);
    };

    const handleJobClaimed = (data: { bookingId: string; assignedTo: string; providerName?: string }) => {
      if (data.bookingId === bookingId) {
        setStatusMessage(`🎉 Order accepted by ${data.providerName || 'a specialist'}!`);
        fetchBooking();
        setTimeout(() => setStatusMessage(''), 4000);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('provider:location-update', handleLocationUpdate);
    socket.on('provider:status-update', handleStatusUpdate);
    socket.on('booking:status-update', handleStatusUpdate);
    socket.on('job:claimed', handleJobClaimed);

    if (socket.connected) handleConnect();

    const pollTimer = setInterval(fetchBooking, 4000);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('provider:location-update', handleLocationUpdate);
      socket.off('provider:status-update', handleStatusUpdate);
      socket.off('booking:status-update', handleStatusUpdate);
      socket.off('job:claimed', handleJobClaimed);
      clearInterval(pollTimer);
    };
  }, [bookingId, fetchBooking]);

  // Timeout + Automatic Re-broadcast when waiting for a specialist
  useEffect(() => {
    const isUnassignedRequested = booking?.status === 'REQUESTED' && !booking?.providerId;

    if (isUnassignedRequested) {
      searchTimerRef.current = setInterval(() => {
        setSearchSeconds((prev) => {
          const next = prev + 1;
          // At 25 seconds, widen search to 15km
          if (next === 25) {
            setSearchRadius(15);
            api.post(`/api/bookings/${bookingId}/rebroadcast`, { radiusKm: 15 }).catch(() => {});
            setStatusMessage('📡 Widening search radius to 15km to find nearby specialists...');
            setTimeout(() => setStatusMessage(''), 4000);
          }
          // At 50 seconds, widen search to 25km
          if (next === 50) {
            setSearchRadius(25);
            api.post(`/api/bookings/${bookingId}/rebroadcast`, { radiusKm: 25 }).catch(() => {});
            setStatusMessage('📡 Widening search radius to 25km across your region...');
            setTimeout(() => setStatusMessage(''), 4000);
          }
          return next;
        });
      }, 1000);
    } else {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    }

    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, [booking?.status, booking?.providerId, bookingId]);

  const advanceStage = async (endpoint: string) => {
    if (!bookingId) return;
    setActionLoading(true);
    try {
      await api.post(`/api/bookings/${endpoint}`, { bookingId });
      setStatusMessage(`✓ Status updated!`);
      await fetchBooking();
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setStatusMessage(`⚠️ ${err.message || 'Action failed'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const retryBroadcast = async () => {
    if (!bookingId) return;
    setSearchSeconds(0);
    setSearchRadius(25);
    try {
      await api.post(`/api/bookings/${bookingId}/rebroadcast`, { radiusKm: 25 });
      setStatusMessage('📡 Re-broadcasted to all active specialists in your region!');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      setStatusMessage(`⚠️ ${err.message || 'Rebroadcast failed'}`);
    }
  };

  const cancelBooking = async () => {
    if (!bookingId) return;
    if (!window.confirm('Are you sure you want to cancel this booking request?')) return;
    try {
      await api.post('/api/bookings/cancel', { bookingId });
      setStatusMessage('✓ Booking request has been cancelled.');
      await fetchBooking();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      setStatusMessage(`⚠️ ${err.message || 'Failed to cancel'}`);
    }
  };

  const currentStepIdx = booking ? STEPS.indexOf(booking.status) : 0;
  const isTerminated = booking ? ['CANCELLED', 'REJECTED'].includes(booking.status) : false;
  const isProvider = user?.role === 'PROVIDER' || (booking?.providerId && booking.providerId === user?.id);

  return (
    <div className="bg-[#f7fafb] px-5 py-8 lg:px-8 pb-20 md:pb-10 min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate(isProvider ? '/provider' : '/history')}
            className="text-xs font-semibold text-primary hover:underline"
          >
            ← Back to {isProvider ? 'Pro Console' : 'My Bookings'}
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                socketConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              {socketConnected ? '● Live Dispatch Stream' : '○ Polling Sync'}
            </span>
          </div>
        </header>

        {statusMessage && (
          <div className="rounded-xl bg-slate-900 p-4 text-xs font-semibold text-white shadow-lg animate-pulse flex items-center gap-2">
            <span>ℹ️</span> {statusMessage}
          </div>
        )}

        {booking && (
          <div className="space-y-6">
            {/* Top Status Overview Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{booking.category?.name || 'Service Dispatch'}</h1>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">📍 Destination: {booking.address}</p>
                <p className="mt-1 text-xs font-medium text-slate-700">
                  {isProvider
                    ? `Customer: ${booking.customer?.name || 'Customer'}`
                    : booking.provider?.name
                    ? `Assigned Specialist: ${booking.provider.name}`
                    : `Assigned Specialist: 🛵 Broadcasting live to nearby pros (within ${searchRadius}km)…`}
                </p>
              </div>

              {!isProvider && booking.status === 'COMPLETED' && (
                <Link
                  to={`/review/${booking.id}`}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700 shadow-sm text-center"
                >
                  Rate & Review
                </Link>
              )}
            </div>

            {/* UNASSIGNED BROADCAST WAITING RADAR (CUSTOMER VIEW) - SWIGGY / ZOMATO STYLE */}
            {!isProvider && booking.status === 'REQUESTED' && !booking.providerId && (
              <div className="rounded-3xl border-2 border-teal-500/60 bg-teal-50/60 p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-600 text-white font-bold text-xl shadow-md animate-pulse">
                      🛵
                    </span>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Swiggy/Zomato Instant Broadcast Active
                      </h3>
                      <p className="text-xs text-slate-600">
                        Radar Search: <span className="font-bold text-teal-800">{searchRadius} km</span> • Searching for{' '}
                        {searchSeconds}s
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      onClick={retryBroadcast}
                      className="rounded-xl border border-teal-300 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 shadow-xs"
                    >
                      🔄 Widen Search
                    </button>
                    <button
                      onClick={cancelBooking}
                      className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 text-xs font-bold text-rose-700 shadow-xs transition"
                    >
                      ✕ Cancel Order
                    </button>
                  </div>
                </div>

                {/* Detected nearby specialists badge list */}
                {nearbyPros.length > 0 ? (
                  <div className="rounded-2xl bg-white border border-teal-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        🟢 {nearbyPros.length} Verified Specialist(s) Online Nearby
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">First specialist to accept will be dispatched</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {nearbyPros.map((pro) => (
                        <div
                          key={pro.providerId}
                          className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-xs"
                        >
                          <span>🛵 {pro.name}</span>
                          <span className="rounded-md bg-teal-200/70 px-1.5 py-0.5 text-[10px] text-teal-900 font-extrabold">
                            {pro.distanceKm} km away
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600 font-medium">
                    🛰️ Dispatched order to specialists in your region. Waiting for first available pro to accept…
                  </div>
                )}

                <div className="w-full bg-teal-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-teal-600 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (searchSeconds / 60) * 100)}%` }}
                  ></div>
                </div>

                {searchSeconds > 60 && (
                  <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-700 flex items-center justify-between">
                    <span>Specialists are currently busy. You can continue waiting or schedule for later.</span>
                    <button onClick={retryBroadcast} className="font-bold text-teal-800 underline ml-2">
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SWIGGY-STYLE PROVIDER DRIVER ACTIONS PANEL */}
            {isProvider && !isTerminated && (
              <div className="rounded-3xl border-2 border-primary bg-teal-50/50 p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="rounded-md bg-primary text-white text-[10px] font-bold px-2 py-0.5 uppercase">
                      Driver Action Cockpit
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">Current Order Action</h3>
                  </div>
                  <div className="flex gap-2">
                    {booking.customer?.phone && (
                      <a
                        href={`tel:${booking.customer.phone}`}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        📞 Call Customer
                      </a>
                    )}
                    <a
                      href={`https://maps.google.com/?q=${booking.lat},${booking.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      🗺️ GPS Directions
                    </a>
                  </div>
                </div>

                <div className="pt-2">
                  {booking.status === 'REQUESTED' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => advanceStage('accept')}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ⚡ Accept & Pick Up Order
                      </button>
                      <button
                        onClick={() => advanceStage('cancel')}
                        disabled={actionLoading}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {booking.status === 'ACCEPTED' && (
                    <button
                      onClick={() => advanceStage('en-route')}
                      disabled={actionLoading}
                      className="w-full rounded-xl bg-violet-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                    >
                      🚗 Start Driving / I'm En Route
                    </button>
                  )}

                  {booking.status === 'EN_ROUTE' && (
                    <button
                      onClick={() => advanceStage('in-progress')}
                      disabled={actionLoading}
                      className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
                    >
                      📍 Arrived at Customer Location / Start Work
                    </button>
                  )}

                  {booking.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => advanceStage('complete')}
                      disabled={actionLoading}
                      className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      ✅ Job Done / Finish Order & Collect Payment
                    </button>
                  )}

                  {booking.status === 'COMPLETED' && (
                    <div className="rounded-xl bg-emerald-100 p-3 text-center text-xs font-bold text-emerald-800">
                      ✓ Order successfully completed! Payout has been recorded to your earnings.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Timeline */}
            {!isTerminated && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Live Order Progress</p>
                <div className="flex justify-between items-center relative">
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                  {STEPS.map((step, idx) => {
                    const isDone = idx <= currentStepIdx;
                    return (
                      <div key={step} className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-2">
                        <div
                          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
                            isDone ? 'bg-primary text-white shadow-sm ring-4 ring-teal-50' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[10px] font-semibold text-center ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                          {STEP_LABELS[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Map Component - Swiggy/Zomato Interactive Live Radar & Specialist Tracker */}
            <div className="h-[440px] overflow-hidden rounded-3xl border border-slate-200 shadow-md relative">
              <MapContainer
                center={[booking.lat ?? 12.9352, booking.lng ?? 77.6245]}
                zoom={15}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Swiggy/Zomato Search Radar Circle */}
                {booking.status === 'REQUESTED' && (
                  <Circle
                    center={[booking.lat, booking.lng]}
                    radius={searchRadius * 1000}
                    pathOptions={{
                      color: '#0d9488',
                      fillColor: '#14b8a6',
                      fillOpacity: 0.12,
                      weight: 2,
                      dashArray: '6, 8',
                    }}
                  />
                )}

                {/* Customer Destination Marker */}
                <Marker position={[booking.lat, booking.lng]} icon={customerMarkerIcon}>
                  <Popup>
                    <div className="space-y-1">
                      <strong className="text-slate-900 font-bold">📍 Your Location (Destination)</strong>
                      <p className="text-xs text-slate-600">{booking.address}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Active Nearby Specialists on Map (Swiggy style!) */}
                {booking.status === 'REQUESTED' &&
                  nearbyPros.map((pro) => (
                    <Marker
                      key={pro.providerId}
                      position={[pro.lat, pro.lng]}
                      icon={nearbyProMarkerIcon}
                    >
                      <Popup>
                        <div className="space-y-1 p-1">
                          <strong className="text-teal-900 font-bold">🛵 {pro.name}</strong>
                          <p className="text-xs text-slate-600 font-medium">Category: {pro.category}</p>
                          <p className="text-xs text-emerald-700 font-bold">📍 {pro.distanceKm} km from you</p>
                          <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            🟢 Online • Broadcast Dispatched
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                {/* Assigned Provider Location */}
                {providerStatus?.lat && providerStatus?.lng && (
                  <Marker position={[providerStatus.lat, providerStatus.lng]} icon={assignedProMarkerIcon}>
                    <Popup>
                      <div className="space-y-1 p-1">
                        <strong className="text-slate-900 font-bold">🚗 {booking.provider?.name || 'Assigned Specialist'}</strong>
                        <p className="text-xs text-slate-600 font-medium">{booking.category?.name || 'Service'} Specialist</p>
                        <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {providerStatus.isOnline ? '🟢 En Route • Live Location Active' : 'Offline'}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
