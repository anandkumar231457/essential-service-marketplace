import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ServiceCategory, NearbyProvider } from '../types';
import ProviderCard from '../components/ProviderCard';

const iconMap: Record<string, string> = {
  zap: '⚡',
  droplet: '💧',
  tool: '🔧',
  sparkles: '✨',
  hammer: '🔨',
  wind: '❄️',
  settings: '🔩',
  wrench: '🛠️',
  'help-circle': '❓',
};

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categoriesData, isLoading: isLoadingCat, error: errorCat } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  const { data: providersData } = useQuery({
    queryKey: ['featured-providers'],
    queryFn: () =>
      api.get<{ providers: NearbyProvider[] }>(
        '/api/providers/nearby?lat=12.9352&lng=77.6245&radiusKm=20',
      ),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/providers?category=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/providers');
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-grid overflow-hidden border-b border-teal-50 bg-gradient-to-br from-white via-white to-teal-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary border border-teal-100">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Verified Local Professionals
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Your Trusted Partner for <span className="text-primary">Any Home Repair</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-500">
              Connect instantly with licensed plumbers, electricians, mechanics, and more. Fair pricing and reliable service near you.
            </p>

            <form
              onSubmit={handleSearchSubmit}
              className="mt-8 flex flex-col gap-3 rounded-2xl bg-white p-3 soft-card sm:flex-row border border-slate-100"
            >
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus-within:border-primary">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="What service do you need? (e.g. Electrician)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-primary px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-700 shadow-sm"
              >
                Find a Pro
              </button>
            </form>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[2rem] bg-teal-100/70 blur-2xl" />
            <img
              className="relative h-[330px] w-full rounded-[1.75rem] object-cover shadow-2xl sm:h-[420px]"
              src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=85"
              alt="Home repair professional"
            />
            <div className="absolute -bottom-5 -left-5 rounded-2xl bg-white p-4 soft-card border border-slate-100">
              <p className="text-xl font-bold text-slate-900">4.9/5</p>
              <p className="text-xs text-slate-500">Average customer rating</p>
              <p className="text-sm tracking-wide text-amber-400">★★★★★</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Categories Section */}
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8 space-y-16">
        <div>
          <div className="mb-8">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">POPULAR SERVICES</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">What can we help with?</h2>
            <p className="mt-2 text-slate-500">Choose from our top-rated essential categories.</p>
          </div>

          {isLoadingCat && <p className="text-slate-500 text-sm">Loading categories…</p>}
          {errorCat && <p className="text-red-600 text-sm">{(errorCat as Error).message}</p>}

          {categoriesData && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {categoriesData.categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/providers?category=${encodeURIComponent(cat.name)}`}
                  className="group rounded-2xl border border-slate-100 bg-white p-6 text-center transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                    {iconMap[cat.icon] ?? '🔧'}
                  </div>
                  <div className="font-bold text-slate-800 text-base group-hover:text-primary transition">
                    {cat.name}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Featured Pros Section */}
        {providersData && providersData.providers.length > 0 && (
          <div>
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold text-primary uppercase tracking-wide">TOP RATED</p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Featured Specialists Nearby</h2>
              </div>
              <Link to="/providers" className="text-sm font-semibold text-primary hover:underline">
                View all pros →
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {providersData.providers.slice(0, 3).map((provider) => (
                <ProviderCard key={provider.providerId} provider={provider} />
              ))}
            </div>
          </div>
        )}

        {/* How it Works */}
        <section className="rounded-3xl bg-slate-950 px-6 py-14 text-center text-white sm:px-12">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-300">SIMPLE & RELIABLE</p>
          <h2 className="mt-2 text-3xl font-bold">How FixItNow Works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="space-y-3">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lg font-bold">1</span>
              <h3 className="font-semibold text-lg">Describe Your Need</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Select a category and tell us your location.</p>
            </div>
            <div className="space-y-3">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lg font-bold">2</span>
              <h3 className="font-semibold text-lg">Select & Book</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Compare verified pros, ratings, and choose a slot.</p>
            </div>
            <div className="space-y-3">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lg font-bold">3</span>
              <h3 className="font-semibold text-lg">Track Live</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Get realtime updates from booking to completion.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
