import { Link, useNavigate } from 'react-router-dom';
import type { NearbyProvider } from '../types';
import StarRating from './StarRating';

interface ProviderCardProps {
  provider: NearbyProvider;
  isSelected?: boolean;
  onSelect?: (provider: NearbyProvider) => void;
}

export default function ProviderCard({ provider, isSelected = false, onSelect }: ProviderCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => onSelect?.(provider)}
      className={`group rounded-2xl border bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md ${
        isSelected ? 'border-primary ring-2 ring-teal-100' : 'border-slate-100'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-50 text-xl font-bold text-primary">
            {provider.name.charAt(0)}
            <span
              className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                provider.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition">{provider.name}</h3>
              {provider.isOnline ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  ● Active Now
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  ○ Offline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">{provider.category} Specialist</p>
            <div className="mt-1 flex items-center gap-2">
              <StarRating rating={provider.avgRating || 5.0} size="sm" showCount />
              <span className="text-xs text-slate-400">• {provider.distanceKm} km away</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">₹{provider.hourlyRate}</p>
          <p className="text-[11px] text-slate-400 font-medium">/ hour</p>
        </div>
      </div>

      {provider.skills && provider.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-50 pt-3">
          {provider.skills.map((skill) => (
            <span key={skill} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          to={`/providers/${provider.providerId}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View Profile
        </Link>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/book/${provider.providerId}?category=${encodeURIComponent(provider.category)}`);
          }}
          className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold text-white transition shadow-sm ${
            provider.isOnline ? 'bg-primary hover:bg-teal-700' : 'bg-slate-800 hover:bg-slate-900'
          }`}
        >
          {provider.isOnline ? '⚡ Book Instant' : '📅 Schedule'}
        </button>
      </div>
    </div>
  );
}
