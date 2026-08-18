import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ServiceCategory } from '../types';

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
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  return (
    <div>
      <section className="hero-grid overflow-hidden border-b border-teal-50 bg-gradient-to-br from-white via-white to-teal-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary">● Trusted local professionals</div><h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">Your Trusted Partner for <span className="text-primary">Any Home Repair</span></h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-500">Connect instantly with licensed plumbers, electricians, mechanics, and more. Get reliable service, fair pricing, and verified professionals near you.</p><div className="mt-8 flex flex-col gap-3 rounded-2xl bg-white p-3 soft-card sm:flex-row"><Link to="/providers" className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">⌕ What service do you need?</Link><Link to="/providers" className="rounded-xl bg-primary px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-700">Find a Pro</Link></div></div>
          <div className="relative mx-auto w-full max-w-lg"><div className="absolute -inset-5 rounded-[2rem] bg-teal-100/70 blur-2xl" /><img className="relative h-[330px] w-full rounded-[1.75rem] object-cover shadow-2xl sm:h-[420px]" src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=85" alt="A home repair professional at work" /><div className="absolute -bottom-5 -left-5 rounded-2xl bg-white p-4 soft-card"><p className="text-xl font-bold text-slate-900">4.9/5</p><p className="text-xs text-slate-500">Average rating</p><p className="text-sm tracking-wide text-amber-400">★★★★★</p></div></div>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="mb-8"><p className="text-sm font-semibold text-primary">POPULAR SERVICES</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">What can we help with?</h2><p className="mt-2 text-slate-500">Choose from our most trusted essential professionals.</p></div>

        {isLoading && <p className="text-gray-500">Loading categories…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        {data && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {data.categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/providers?category=${encodeURIComponent(cat.name)}`}
                className="group rounded-2xl border border-slate-100 bg-white p-6 text-center transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-lg"
              >
                <div className="text-4xl mb-2">{iconMap[cat.icon] ?? '❓'}</div>
                <div className="font-semibold text-slate-800">{cat.name}</div>
              </Link>
            ))}
          </div>
        )}
        <section className="mt-20 rounded-3xl bg-slate-950 px-6 py-12 text-center text-white sm:px-12"><p className="text-sm font-semibold uppercase tracking-[.18em] text-teal-300">Simple and reliable</p><h2 className="mt-3 text-3xl font-bold">How FixItNow works</h2><div className="mt-10 grid gap-8 md:grid-cols-3"><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary font-bold">1</span><h3 className="mt-4 font-semibold">Describe your need</h3><p className="mt-2 text-sm leading-6 text-slate-400">Tell us what needs fixing and where.</p></div><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary font-bold">2</span><h3 className="mt-4 font-semibold">Review & book</h3><p className="mt-2 text-sm leading-6 text-slate-400">Compare verified pros and choose a time.</p></div><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary font-bold">3</span><h3 className="mt-4 font-semibold">Track with confidence</h3><p className="mt-2 text-sm leading-6 text-slate-400">Stay updated from request to completion.</p></div></div></section>
      </main>
    </div>
  );
}
