import { Link } from 'react-router-dom';
import type { Booking } from '../types';

export type HistoryBooking = Booking & {
  category?: { name: string; icon?: string };
  provider?: { id?: string; name: string; phone?: string; rating?: number };
  customer?: { id?: string; name: string; phone?: string };
  review?: { id: number; rating?: number };
  price?: number;
};

interface BookingCardProps {
  booking: HistoryBooking;
  isProviderView?: boolean;
}

export default function BookingCard({ booking, isProviderView = false }: BookingCardProps) {
  const formattedDate = new Date(booking.requestedAt || Date.now()).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const categoryName = booking.category?.name || 'Home Service';
  const price = booking.price ? `$${booking.price.toFixed(2)}` : '$120.00';

  // Category Icon Resolver
  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'plumbing':
      case 'plumber':
        return '🔧';
      case 'electrical':
      case 'electrician':
        return '⚡';
      case 'cleaning':
      case 'cleaner':
        return '🧹';
      case 'ac repair':
      case 'ac technician':
        return '❄️';
      case 'carpenter':
        return '🪚';
      default:
        return '🛠️';
    }
  };

  return (
    <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md space-y-4">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E6F7F5] text-xl text-teal-700 shadow-xs shrink-0">
            {getCategoryIcon(categoryName)}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{categoryName} Repair</h3>
            <p className="text-xs text-slate-400 font-medium">
              Booking ID: FIN-{booking.id.slice(-6).toUpperCase()} • {booking.status === 'COMPLETED' ? 'Completed on' : 'Scheduled on'} {formattedDate}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-extrabold text-teal-700">{price}</p>
        </div>
      </div>

      {/* Specialist / Customer Details Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-50 pt-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 overflow-hidden shrink-0 border border-slate-200">
            {isProviderView
              ? (booking.customer?.name?.charAt(0) || 'C')
              : (booking.provider?.name?.charAt(0) || 'P')}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              {isProviderView
                ? (booking.customer?.name || 'Customer')
                : (booking.provider?.name || 'Assigned Specialist')}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              {isProviderView ? 'Client' : `Senior ${categoryName}`}
            </p>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase text-slate-400">Address Details</p>
          <p className="text-xs font-semibold text-slate-700 truncate max-w-xs">{booking.address}</p>
        </div>

        <div>
          {booking.review ? (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
              <span>★★★★★</span>
              <span className="text-slate-500 font-medium text-[11px]">Reviewed</span>
            </div>
          ) : (
            <Link
              to={`/review/${booking.id}`}
              className="rounded-xl border border-teal-600 px-3.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 transition inline-block"
            >
              Rate Specialist
            </Link>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Link
          to={`/book/${booking.providerId || '1'}?category=${encodeURIComponent(categoryName)}`}
          className="rounded-xl bg-teal-600 hover:bg-teal-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition text-center"
        >
          Rebook Specialist
        </Link>
        <Link
          to={`/booking/${booking.id}/confirmed`}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition text-center"
        >
          View Invoice & Details
        </Link>
      </div>
    </article>
  );
}
