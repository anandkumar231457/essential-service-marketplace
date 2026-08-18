import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function BookingConfirmation() {
  const { bookingId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    enabled: Boolean(bookingId),
    queryFn: () =>
      api.get<{
        booking: Booking & { provider?: { name: string; phone: string }; category?: { name: string } };
      }>(`/api/bookings/${bookingId}`),
  });

  return (
    <div className="flex min-h-[75vh] items-center justify-center bg-[#f7fafb] px-5 py-12 pb-20 md:pb-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal-50 text-3xl text-primary font-bold">
          ✓
        </div>
        <p className="mt-4 text-xs font-semibold text-primary uppercase tracking-wide">BOOKING SUCCESSFUL</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Request Sent to Specialist</h1>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
          Your booking has been received. You will receive live status updates as the provider accepts and travels to your location.
        </p>

        {isLoading ? (
          <p className="mt-6 text-xs text-slate-500">Loading booking summary…</p>
        ) : (
          <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
              <span className="font-bold text-slate-900 text-sm">{data?.booking.category?.name || 'Service Request'}</span>
              <StatusBadge status={data?.booking.status || 'REQUESTED'} />
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Booking ID</span>
              <span className="font-mono text-slate-800">#{data?.booking.id.slice(-8)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Assigned Specialist</span>
              <span className="font-semibold text-slate-900">{data?.booking.provider?.name || 'Local Pro'}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Service Location</span>
              <span className="font-medium text-slate-800 max-w-[200px] text-right truncate">{data?.booking.address}</span>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={`/track/${bookingId}`}
            className="flex-1 rounded-xl bg-primary px-5 py-3 text-xs font-semibold text-white transition hover:bg-teal-700 shadow-sm"
          >
            Track Live Status
          </Link>
          <Link
            to="/history"
            className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View All Bookings
          </Link>
        </div>
      </section>
    </div>
  );
}
