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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-800">
            {category ? `${category}s` : 'Nearby Providers'}
          </h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading && <p className="text-gray-500">Finding providers near you…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Map */}
            <div className="h-[400px] rounded-lg overflow-hidden shadow">
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
            <div className="space-y-3">
              {data.providers.length === 0 && (
                <p className="text-gray-500">No providers found nearby.</p>
              )}
              {data.providers.map((p) => (
                <div
                  key={p.providerId}
                  className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{p.name}</div>
                    <div className="text-sm text-gray-600">
                      {p.category} · {p.skills.join(', ')}
                    </div>
                    <div className="text-sm text-gray-500">
                      ⭐ {p.avgRating} · {p.distanceKm} km away
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">₹{p.hourlyRate}/hr</div>
                    <button
                      onClick={() => navigate(`/book/${p.providerId}?category=${encodeURIComponent(p.category)}`)}
                      className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 text-sm"
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