import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking } from '../types';

type HistoryBooking = Booking & { category?: { name: string }; provider?: { name: string }; customer?: { name: string }; review?: { id: number } };

export default function History() {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-bookings'], queryFn: () => api.get<{ bookings: HistoryBooking[] }>('/api/bookings/my') });
  return <div className="bg-[#f7fafb] px-5 py-10 lg:px-8"><div className="mx-auto max-w-5xl"><p className="text-sm font-semibold text-primary">YOUR ACTIVITY</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Booking history</h1><p className="mt-2 text-slate-500">Every service request, in one easy place.</p><div className="mt-8 space-y-4">{isLoading && <p className="text-slate-500">Loading bookings…</p>}{error && <p className="text-red-600">{(error as Error).message}</p>}{data?.bookings.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">No bookings yet. Find a trusted professional to get started.</div>}{data?.bookings.map((booking) => <article key={booking.id} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">{booking.category?.name || 'Home service'}</p><p className="mt-1 text-sm text-slate-500">{booking.address}</p><p className="mt-1 text-xs font-semibold text-primary">{booking.status.replace('_', ' ')}</p></div><div className="flex gap-3"><Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" to={`/track/${booking.id}`}>View details</Link>{booking.status === 'COMPLETED' && !booking.review && <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" to={`/review/${booking.id}`}>Leave review</Link>}</div></article>)}</div></div></div>;
}
