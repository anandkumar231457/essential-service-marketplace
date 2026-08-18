import { Link } from 'react-router-dom';
import type { Booking } from '../types';
import StatusBadge from './StatusBadge';

export type HistoryBooking = Booking & {
  category?: { name: string };
  provider?: { name: string };
  customer?: { name: string };
  review?: { id: number };
};

interface BookingCardProps {
  booking: HistoryBooking;
  isProviderView?: boolean;
}

export default function BookingCard({ booking, isProviderView = false }: BookingCardProps) {
  const formattedDate = new Date(booking.requestedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <StatusBadge status={booking.status} />
          <span className="text-xs text-slate-400 font-medium">{formattedDate}</span>
        </div>
        <h3 className="font-bold text-slate-900 text-base">
          {booking.category?.name || 'Home Repair Service'}
        </h3>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <span>📍</span> {booking.address}
        </p>
        <p className="text-xs font-medium text-slate-700">
          {isProviderView
            ? `Customer: ${booking.customer?.name || 'Client'}`
            : `Provider: ${booking.provider?.name || 'Assigned Specialist'}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <Link
          to={`/track/${booking.id}`}
          className="flex-1 sm:flex-initial rounded-xl border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {['COMPLETED', 'CANCELLED', 'REJECTED'].includes(booking.status) ? 'View Details' : 'Track Status'}
        </Link>
        {!isProviderView && booking.status === 'COMPLETED' && !booking.review && (
          <Link
            to={`/review/${booking.id}`}
            className="flex-1 sm:flex-initial rounded-xl bg-primary px-4 py-2 text-center text-xs font-semibold text-white transition hover:bg-teal-700 shadow-sm"
          >
            Leave Review
          </Link>
        )}
      </div>
    </article>
  );
}
