import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { NearbyProvider, ServiceCategory } from '../types';
import ProviderCard from '../components/ProviderCard';
import FilterPanel from '../components/FilterPanel';

const defaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function Providers() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryParam = searchParams.get('category') ?? '';

  // Center coordinates based on user's profile location or GPS
  const [center, setCenter] = useState<[number, number]>(() => {
    if (typeof user?.lat === 'number' && typeof user?.lng === 'number') {
      return [user.lat, user.lng];
    }
    return [12.9352, 77.6245];
  });
  const [locationLabel, setLocationLabel] = useState<string>(user?.address || 'Current Location');

  // Detect GPS on mount if no profile coordinates
  useEffect(() => {
    if (typeof user?.lat === 'number' && typeof user?.lng === 'number') {
      setCenter([user.lat, user.lng]);
      if (user.address) setLocationLabel(user.address);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setLocationLabel('My GPS Location');
        },
        () => {}
      );
    }
  }, [user]);

  const handleRecenterGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setLocationLabel('My GPS Location');
        },
        () => alert('Could not access mobile GPS location.')
      );
    }
  };

  // Local filter states
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2000);
  const [sortBy, setSortBy] = useState('distance');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Fetch categories for filter dropdown
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  // Fetch nearby providers around center coordinates
  const { data, isLoading, error } = useQuery({
    queryKey: ['nearby', selectedCategory, center[0], center[1]],
    queryFn: () =>
      api.get<{ providers: NearbyProvider[]; count: number }>(
        `/api/providers/nearby?lat=${center[0]}&lng=${center[1]}&radiusKm=25${
          selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : ''
        }`,
      ),
  });

  // Handle category change from filter
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('');
    setMinRating(0);
    setMaxPrice(2000);
    setSortBy('distance');
    setOnlyOnline(false);
    setSearchParams({});
  };

  // Filter & Sort logic
  const filteredProviders = useMemo(() => {
    if (!data?.providers) return [];
    let list = [...data.providers];

    if (minRating > 0) {
      list = list.filter((p) => (p.avgRating || 5.0) >= minRating);
    }
    if (maxPrice < 2000) {
      list = list.filter((p) => p.hourlyRate <= maxPrice);
    }
    if (onlyOnline) {
      list = list.filter((p) => p.isOnline);
    }

    if (sortBy === 'rating') {
      list.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    } else if (sortBy === 'price_low') {
      list.sort((a, b) => a.hourlyRate - b.hourlyRate);
    } else if (sortBy === 'price_high') {
      list.sort((a, b) => b.hourlyRate - a.hourlyRate);
    } else {
      // distance
      list.sort((a, b) => parseFloat(a.distanceKm) - parseFloat(b.distanceKm));
    }

    return list;
  }, [data, minRating, maxPrice, onlyOnline, sortBy]);

  return (
    <div className="bg-[#f7fafb] pb-20 md:pb-10">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <button onClick={() => navigate('/')} className="text-xs font-semibold text-primary hover:underline">
            ← Back to Home
          </button>
          <h1 className="text-lg font-bold text-slate-800">
            {selectedCategory ? `${selectedCategory}s` : 'All Specialists'}
          </h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              SEARCHING NEAR: {locationLabel}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {filteredProviders.length} Specialists Available
            </h2>
          </div>

          <button
            onClick={handleRecenterGps}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-teal-200 hover:text-primary transition flex items-center gap-1.5 w-fit"
          >
            📍 Focus on My Current Location
          </button>
        </div>

        {isLoading && <p className="text-slate-500 text-sm">Finding specialists near your location…</p>}
        {error && <p className="text-red-600 text-sm">{(error as Error).message}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filters Column */}
          <div>
            <FilterPanel
              categories={categoriesData?.categories ?? []}
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategoryChange}
              minRating={minRating}
              onSelectMinRating={setMinRating}
              maxPrice={maxPrice}
              onSelectMaxPrice={setMaxPrice}
              sortBy={sortBy}
              onSelectSortBy={setSortBy}
              onlyOnline={onlyOnline}
              onToggleOnlyOnline={setOnlyOnline}
              onReset={handleResetFilters}
            />
          </div>

          {/* Results + Map */}
          <div className="space-y-6">
            {/* Interactive Leaflet Map Centered on User Location */}
            <div className="h-[360px] overflow-hidden rounded-2xl border border-slate-100 shadow-sm relative">
              <MapContainer center={center} zoom={13} className="h-full w-full">
                <MapController center={center} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* User location pin */}
                <Marker position={center} icon={defaultIcon}>
                  <Popup>
                    <strong>📍 Your Location</strong>
                    <br />
                    {locationLabel}
                  </Popup>
                </Marker>

                {filteredProviders.map((p) => (
                  <Marker
                    key={p.providerId}
                    position={[p.lat, p.lng]}
                    eventHandlers={{
                      click: () => setSelectedProviderId(p.providerId),
                    }}
                  >
                    <Popup>
                      <div className="p-1">
                        <strong className="text-slate-900">{p.name}</strong>
                        <p className="text-xs text-slate-600">
                          {p.category} • ₹{p.hourlyRate}/hr
                        </p>
                        <p className="text-xs text-amber-500 font-bold">★ {p.avgRating || 5.0}</p>
                        <span className="text-[10px] text-slate-400">{p.distanceKm} km away</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Provider List */}
            {filteredProviders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                No specialists match your criteria in this area. Try selecting "All Categories" or resetting filters.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredProviders.map((p) => (
                  <ProviderCard
                    key={p.providerId}
                    provider={p}
                    isSelected={selectedProviderId === p.providerId}
                    onSelect={() => setSelectedProviderId(p.providerId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
