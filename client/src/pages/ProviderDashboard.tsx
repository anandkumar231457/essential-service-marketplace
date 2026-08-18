import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { Booking } from '../types';

type ProviderBooking = Booking & { customer?: { name: string; phone: string }; category?: { name: string } };

const statusStyle: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700', ACCEPTED: 'bg-sky-50 text-sky-700', EN_ROUTE: 'bg-violet-50 text-violet-700', IN_PROGRESS: 'bg-orange-50 text-orange-700', COMPLETED: 'bg-emerald-50 text-emerald-700', CANCELLED: 'bg-rose-50 text-rose-700', REJECTED: 'bg-rose-50 text-rose-700',
};

export default function ProviderDashboard() {
  const user = useAuthStore((state) => state.user);
  const [available, setAvailable] = useState(true);
  const { data, isLoading } = useQuery({ queryKey: ['my-bookings'], queryFn: () => api.get<{ bookings: ProviderBooking[] }>('/api/bookings/my') });
  const active = data?.bookings.filter((booking) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(booking.status)) ?? [];
  const setAvailability = async () => {
    const next = !available;
    await api.post('/api/providers/ping', { lat: 12.9352, lng: 77.6245, isOnline: next });
    setAvailable(next);
  };
  return <div className="bg-[#f7fafb] px-5 py-10 lg:px-8"><div className="mx-auto max-w-7xl"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-primary">PRO CONSOLE</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Welcome back, {user?.name?.split(' ')[0] || 'Pro'}</h1><p className="mt-2 text-slate-500">Manage requests and keep customers informed.</p></div><button onClick={() => void setAvailability()} className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${available ? 'bg-primary' : 'bg-slate-500'}`}>{available ? 'You’re available' : 'You’re offline'}</button></div><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-sm text-slate-400">Active jobs</p><p className="mt-3 text-4xl font-bold">{active.length}</p><p className="mt-2 text-sm text-teal-300">Ready for your attention</p></div><div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">New requests</p><p className="mt-3 text-4xl font-bold text-slate-900">{data?.bookings.filter((booking) => booking.status === 'REQUESTED').length ?? 0}</p><p className="mt-2 text-sm text-primary">Review and respond quickly</p></div><div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Completed this month</p><p className="mt-3 text-4xl font-bold text-slate-900">{data?.bookings.filter((booking) => booking.status === 'COMPLETED').length ?? 0}</p><p className="mt-2 text-sm text-slate-500">Your work history is saved</p></div></div><section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Job requests & active work</h2><p className="text-sm text-slate-500">Keep every customer update on track.</p></div><Link to="/history" className="text-sm font-semibold text-primary">View all</Link></div>{isLoading ? <p className="text-sm text-slate-500">Loading your work queue…</p> : active.length === 0 ? <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No active jobs yet. New customer requests will appear here.</div> : <div className="space-y-3">{active.map((booking) => <Link key={booking.id} to={`/track/${booking.id}`} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-teal-200 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{booking.category?.name || 'Service request'} for {booking.customer?.name || 'Customer'}</p><p className="mt-1 text-sm text-slate-500">{booking.address}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusStyle[booking.status]}`}>{booking.status.replace('_', ' ')}</span></Link>)}</div>}</section></div></div>;
}
