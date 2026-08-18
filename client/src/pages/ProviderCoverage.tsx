import { useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { Link } from 'react-router-dom';

const defaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [12.9352, 77.6245];

export default function ProviderCoverage() {
  const [radiusKm, setRadiusKm] = useState(10);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-primary">SERVICE RADIUS</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Coverage Area</h1>
          </div>
          <Link to="/provider" className="text-xs font-semibold text-primary hover:underline">
            ← Back to Console
          </Link>
        </div>

        {saved && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800">
            ✓ Service area radius saved!
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
          <div className="h-[400px] overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
            <MapContainer center={DEFAULT_CENTER} zoom={11} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={DEFAULT_CENTER} icon={defaultIcon} />
              <Circle
                center={DEFAULT_CENTER}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#009c91', fillColor: '#009c91', fillOpacity: 0.15 }}
              />
            </MapContainer>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Set Operating Radius</h3>
              <p className="text-xs text-slate-500 mb-6">
                You will receive job requests within this distance from your registered home base.
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                    <span>Radius Distance</span>
                    <span className="text-primary font-bold">{radiusKm} km</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="50"
                    step="1"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  {[5, 10, 20, 50].map((km) => (
                    <button
                      key={km}
                      onClick={() => setRadiusKm(km)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold ${
                        radiusKm === km
                          ? 'border-primary bg-teal-50 text-primary'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-teal-700 shadow-sm"
            >
              Update Coverage Zone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
