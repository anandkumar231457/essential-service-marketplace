import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../lib/api';
import type { NearbyProvider } from '../types';

// Fix default marker icons (Leaflet's default icons break under bundlers)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

// Bengaluru center (Koramangala)
const DEFAULT_CENTER: [number, number] = [12.9352, 77.6245];

export default function Providers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['nearby', category],
    queryFn: () =>
      api.get<{ providers: NearbyProvider[]; count: number }>(
        `/api/providers/nearby?lat=${DEFAULT_CENTER[0]}&lng=${DEFAULT_CENTER[1]}&radiusKm=10${
          category ? `&category=${encodeURIComponent(category)}` : ''
        }`,
      ),
  });

  return (
    <div className="bg-[#f7fafb]">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-8">
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-slate-800">
            {category ? `${category}s` : 'Nearby Providers'}
          </h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-8"><p className="text-sm font-semibold text-primary">LOCAL PROFESSIONALS</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Choose a trusted specialist</h2><p className="mt-2 text-slate-500">Compare nearby pros, transparent pricing, and verified skills.</p></div>
        {isLoading && <p className="text-gray-500">Finding providers near you…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        {data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
            {/* Map */}
            <div className="h-[480px] overflow-hidden rounded-2xl border border-slate-100 shadow-sm lg:sticky lg:top-24">
              <MapContainer center={DEFAULT_CENTER} zoom={13} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {data.providers.map((p) => (
                  <Marker key={p.providerId} position={[p.lat, p.lng]}>
                    <Popup>
                      <strong>{p.name}</strong>
                      <br />
                      {p.category} · ₹{p.hourlyRate}/hr
                      <br />
                      ⭐ {p.avgRating} · {p.distanceKm} km
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* List */}
            <div className="space-y-4">
              {data.providers.length === 0 && (
                <p className="text-gray-500">No providers found nearby.</p>
              )}
              {data.providers.map((p) => (
                <div
                  key={p.providerId}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md"
                >
                  <div>
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {p.category} · {p.skills.join(', ')}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      ⭐ {p.avgRating} · {p.distanceKm} km away
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">₹{p.hourlyRate}/hr</div>
                    <button
                      onClick={() => navigate(`/book/${p.providerId}?category=${encodeURIComponent(p.category)}`)}
                      className="mt-3 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                    >
                      Book
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
