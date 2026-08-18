import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
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

export default function Track() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<(Booking & { provider?: { name: string; phone: string }; category?: { name: string } }) | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    api
      .get<{ booking: Booking & { provider?: { name: string; phone: string }; category?: { name: string } } }>(`/api/bookings/${bookingId}`)
      .then((d) => setBooking(d.booking))
      .catch(() => {});
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
      });
      socket.on('disconnect', () => setSocketConnected(false));
    } catch {
      // ignore socket errors
    }

    pollTimer = setInterval(async () => {
      try {
        const bookingData = await api.get<{ booking: Booking & { provider?: { name: string; phone: string }; category?: { name: string } } }>(`/api/bookings/${bookingId}`);
        setBooking(bookingData.booking);
        if (bookingData.booking.providerId) {
          const status = await api.get<ProviderStatus>(`/api/providers/${bookingData.booking.providerId}/status`);
          setProviderStatus(status);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => {
      socket?.disconnect();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [bookingId]);

  const currentStepIdx = booking ? STEPS.indexOf(booking.status) : 0;
  const isTerminated = booking ? ['CANCELLED', 'REJECTED'].includes(booking.status) : false;

  return (
    <div className="bg-[#f7fafb] px-5 py-8 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/history')} className="text-xs font-semibold text-primary hover:underline">
            ← Back to History
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${socketConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              {socketConnected ? '● Live Socket' : '○ Polling Fallback'}
            </span>
          </div>
        </header>

        {booking && (
          <div className="space-y-6">
            {/* Top Status Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{booking.category?.name || 'Service Dispatch'}</h1>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">📍 {booking.address}</p>
                <p className="mt-1 text-xs font-medium text-slate-700">Specialist: {booking.provider?.name || 'Assigned Specialist'}</p>
              </div>

              {booking.status === 'COMPLETED' && (
                <Link
                  to={`/review/${booking.id}`}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700 shadow-sm text-center"
                >
                  Rate & Review
                </Link>
              )}
            </div>

            {/* Status Timeline */}
            {!isTerminated && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Job Progress Timeline</p>
                <div className="flex justify-between items-center relative">
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                  {STEPS.map((step, idx) => {
                    const isDone = idx <= currentStepIdx;
                    return (
                      <div key={step} className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-2">
                        <div
                          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
                            isDone ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[10px] font-semibold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                          {step.replace('_', ' ')}
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
                  <Popup>Customer Location</Popup>
                </Marker>

                {/* Provider Location */}
                {providerStatus?.lat && providerStatus?.lng && (
                  <Marker position={[providerStatus.lat, providerStatus.lng]} icon={defaultIcon}>
                    <Popup>
                      <strong>{booking.provider?.name || 'Provider'}</strong>
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
