import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Booking } from '../types';
import EarningsChart from '../components/EarningsChart';
import { Link } from 'react-router-dom';

export default function ProviderEarnings() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<{ bookings: Booking[] }>('/api/bookings/my'),
  });

  const completed = data?.bookings.filter((b) => b.status === 'COMPLETED') ?? [];
  const estimatedRate = 500; // default estimated rate per job
  const totalEarnings = completed.length * estimatedRate;

  const chartData = [
    { label: 'Mon', amount: 500 },
    { label: 'Tue', amount: 1000 },
    { label: 'Wed', amount: 1500 },
    { label: 'Thu', amount: 500 },
    { label: 'Fri', amount: 2000 },
    { label: 'Sat', amount: 2500 },
    { label: 'Sun', amount: 1000 },
  ];

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-primary">FINANCIAL OVERVIEW</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Provider Earnings</h1>
          </div>
          <Link to="/provider" className="text-xs font-semibold text-primary hover:underline">
            ← Back to Console
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-medium text-slate-400">Total Revenue</p>
            <p className="mt-2 text-3xl font-bold">₹{totalEarnings}</p>
            <p className="mt-1 text-xs text-teal-300">From {completed.length} completed jobs</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Average Per Job</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">₹{estimatedRate}</p>
            <p className="text-xs text-slate-400 mt-1">Based on active rate</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Payout Status</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">Cleared</p>
            <p className="text-xs text-slate-400 mt-1">Weekly automatic transfer</p>
          </div>
        </div>

        <EarningsChart data={chartData} />

        {/* Transactions list */}
        <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-4">Completed Job Transactions</h3>
          {isLoading ? (
            <p className="text-xs text-slate-500">Loading payout records…</p>
          ) : completed.length === 0 ? (
            <p className="text-xs text-slate-500">No completed transactions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {completed.map((job) => (
                <div key={job.id} className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Service Payout - #{job.id.slice(-6)}</p>
                    <p className="text-xs text-slate-500">{job.address}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+₹{estimatedRate}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
