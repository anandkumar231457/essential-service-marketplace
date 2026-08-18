import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { Booking } from '../types';

// Fix default marker icons
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

export default function Track() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const user = useAuthStore((state) => state.user);
  const transition = useMutation({
    mutationFn: (endpoint: string) => api.post<{ booking: Booking }>(endpoint, { bookingId }),
    onSuccess: (data) => setBooking(data.booking),
  });

  // Fetch booking details
  useEffect(() => {
    if (!bookingId) return;
    api
      .get<{ booking: Booking }>(`/api/bookings/${bookingId}`)
      .then((d) => setBooking(d.booking))
      .catch(() => {});
  }, [bookingId]);

  // Socket.io live tracking + polling fallback
  useEffect(() => {
    if (!bookingId) return;

    let socket: Socket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Try Socket.io first
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
      // Socket failed — fall back to polling
    }

    // Polling fallback (every 3s) — used if socket disconnects
    pollTimer = setInterval(async () => {
      try {
        const bookingData = await api.get<{ booking: Booking }>(`/api/bookings/${bookingId}`);
        setBooking(bookingData.booking);
        if (bookingData.booking.providerId) {
          const status = await api.get<ProviderStatus>(
            `/api/providers/${bookingData.booking.providerId}/status`,
          );
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

  const statusColor: Record<string, string> = {
    REQUESTED: 'bg-yellow-100 text-yellow-800',
    ACCEPTED: 'bg-blue-100 text-blue-800',
    EN_ROUTE: 'bg-purple-100 text-purple-800',
    IN_PROGRESS: 'bg-orange-100 text-orange-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-red-100 text-red-800',
  };
  const providerAction: Record<string, { endpoint: string; label: string }> = {
    REQUESTED: { endpoint: '/api/bookings/accept', label: 'Accept request' },
    ACCEPTED: { endpoint: '/api/bookings/en-route', label: 'Start travel' },
    EN_ROUTE: { endpoint: '/api/bookings/in-progress', label: 'Mark arrived' },
    IN_PROGRESS: { endpoint: '/api/bookings/complete', label: 'Complete service' },
  };

  return (
    <div className="bg-[#f7fafb]">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 lg:px-8">
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">
            ← Home
          </button>
          <h1 className="text-xl font-bold text-slate-800">Live service tracking</h1>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              socketConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {socketConnected ? '● Live' : '○ Polling'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="mb-8"><p className="text-sm font-semibold text-primary">BOOKING STATUS</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Your repair is in motion</h2><p className="mt-2 text-slate-500">Follow your professional’s progress in real time.</p></div>
        {booking && (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                statusColor[booking.status] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {booking.status}
            </span>
            <p className="mt-2 text-sm text-gray-600">{booking.address}</p>
            {user?.role === 'PROVIDER' && providerAction[booking.status] && <button onClick={() => transition.mutate(providerAction[booking.status].endpoint)} disabled={transition.isPending} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{transition.isPending ? 'Updating…' : providerAction[booking.status].label}</button>}
            {transition.isError && <p className="mt-3 text-sm text-red-600">{(transition.error as Error).message}</p>}
          </div>
        )}

        <div className="h-[480px] overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
          <MapContainer
            center={[providerStatus?.lat ?? 12.9352, providerStatus?.lng ?? 77.6245]}
            zoom={14}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {providerStatus?.lat && providerStatus?.lng && (
              <Marker position={[providerStatus.lat, providerStatus.lng]}>
                <Popup>
                  Provider location
                  <br />
                  {providerStatus.isOnline ? 'Online' : 'Offline'}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {booking?.status === 'COMPLETED' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate(`/review/${booking.id}`)}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-teal-700"
            >
              Rate this service
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
