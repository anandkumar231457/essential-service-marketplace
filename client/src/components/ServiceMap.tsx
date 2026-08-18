import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { NearbyProvider } from '../types';

const pin = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

interface ServiceMapProps {
  center: [number, number];
  providers?: NearbyProvider[];
  height?: string;
  selectedId?: string;
  onSelect?: (provider: NearbyProvider) => void;
  customerLabel?: string;
}

export default function ServiceMap({ center, providers = [], height = '480px', selectedId, onSelect, customerLabel }: ServiceMapProps) {
  return <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm" style={{ height }}>
    <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {customerLabel && <Marker position={center} icon={pin}><Popup>{customerLabel}</Popup></Marker>}
      {providers.map((provider) => <Marker key={provider.providerId} position={[provider.lat, provider.lng]} icon={pin} eventHandlers={{ click: () => onSelect?.(provider) }}>
        <Popup><strong>{provider.name}</strong><br />{provider.category} · ₹{provider.hourlyRate}/hr<br />★ {provider.avgRating} · {provider.distanceKm} km</Popup>
      </Marker>)}
      {selectedId && providers.filter((p) => p.providerId === selectedId).map((p) => <Marker key={`selected-${p.providerId}`} position={[p.lat, p.lng]} icon={pin} />)}
    </MapContainer>
  </div>;
}
