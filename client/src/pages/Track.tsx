import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
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

interface ProviderStatus {
  providerId: string;
  isOnline: boolean;
  lat?: number;
  lng?: number;
  lastSeen?: string;
}

const STEPS = ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];

const STEP_LABELS: Record<string, string> = {
  REQUESTED: 'Order Placed',
  ACCEPTED: 'Order Accepted',
  EN_ROUTE: 'Specialist En Route',
  IN_PROGRESS: 'Service Underway',
  COMPLETED: 'Service Finished',
};

export default function Track() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [booking, setBooking] = useState<(Booking & { provider?: { name: string; phone: string }; customer?: { name: string; phone: string }; category?: { name: string } }) | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchBooking = async () => {
    if (!bookingId) return;
    try {
      const data = await api.get<{ booking: Booking & { provider?: { name: string; phone: string }; customer?: { name: string; phone: string }; category?: { name: string } } }>(`/api/bookings/${bookingId}`);
      setBooking(data.booking);
      if (data.booking.providerId) {
        const status = await api.get<ProviderStatus>(`/api/providers/${data.booking.providerId}/status`);
        setProviderStatus(status);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;

    let socket: Socket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    try {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
      socket = io(socketUrl, { transports: ['websocket'] });
      socket.on('connect', () => {
        setSocketConnected(true);
        socket?.emit('join-booking-room', bookingId);
      });
      socket.on('provider:location-update', (data: ProviderStatus) => {
        setProviderStatus(data);
      });
      socket.on('provider:status-update', (data: ProviderStatus) => {
        setProviderStatus(data);
        fetchBooking();
      });
      socket.on('disconnect', () => setSocketConnected(false));
    } catch {
      // ignore socket errors
    }

    pollTimer = setInterval(fetchBooking, 3000);

    return () => {
      socket?.disconnect();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [bookingId]);

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

  const currentStepIdx = booking ? STEPS.indexOf(booking.status) : 0;
  const isTerminated = booking ? ['CANCELLED', 'REJECTED'].includes(booking.status) : false;
  const isProvider = user?.role === 'PROVIDER';

  return (
    <div className="bg-[#f7fafb] px-5 py-8 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between mb-6">
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
          <div className="mb-4 rounded-xl bg-slate-900 p-3 text-xs font-semibold text-white shadow-md animate-pulse">
            {statusMessage}
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
                    : `Assigned Specialist: ${booking.provider?.name || 'Local Pro'}`}
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

            {/* Map Component */}
            <div className="h-[400px] overflow-hidden rounded-2xl border border-slate-100 shadow-sm relative">
              <MapContainer
                center={[providerStatus?.lat ?? booking.lat ?? 12.9352, providerStatus?.lng ?? booking.lng ?? 77.6245]}
                zoom={14}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Customer Location */}
                <Marker position={[booking.lat, booking.lng]} icon={defaultIcon}>
                  <Popup>
                    <strong>📍 Customer Destination</strong>
                    <br />
                    {booking.address}
                  </Popup>
                </Marker>

                {/* Provider Location */}
                {providerStatus?.lat && providerStatus?.lng && (
                  <Marker position={[providerStatus.lat, providerStatus.lng]} icon={defaultIcon}>
                    <Popup>
                      <strong>🚗 {booking.provider?.name || 'Specialist'}</strong>
                      <br />
                      Status: {providerStatus.isOnline ? 'Online' : 'Offline'}
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
