import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking } from '../types';

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => api.post('/api/bookings/cancel', { bookingId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['open-jobs'] });
      alert('Booking cancelled successfully.');
      navigate('/history');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to cancel booking');
    },
  });

  const { data } = useQuery({
    queryKey: ['booking', bookingId],
    enabled: Boolean(bookingId),
    refetchInterval: 10000, // Poll every 10s until provider accepts
    queryFn: () =>
      api.get<{
        booking: Booking & {
          provider?: { name: string; phone: string; rating?: number };
          category?: { name: string };
        };
      }>(`/api/bookings/${bookingId}`),
  });


  const booking = data?.booking;
  const bookingCode = booking ? `FIN-${booking.id.slice(-6).toUpperCase()}` : '…';
  const categoryName = booking?.category?.name || 'Home Service';
  const providerName = booking?.provider?.name || null;
  const address = booking?.address || '—';
  
  const formattedDate = booking?.scheduledAt
    ? new Date(booking.scheduledAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';


  return (
    <div className="bg-[#f7fafb] px-4 py-12 sm:px-6 lg:px-8 pb-24 md:pb-16 min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top Success Header Card */}
        <section className="rounded-3xl border border-slate-100 bg-white p-8 sm:p-10 text-center shadow-sm space-y-3">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E6F7F5] text-teal-600 font-extrabold text-2xl shadow-xs">
            ✓
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Booking Confirmed!</h1>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            Your request is secured. Provider is notified and will arrive within the scheduled window.
          </p>

          <div className="pt-2">
            <span className="inline-block rounded-lg bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-700">
              Booking ID: <span className="font-mono text-slate-900">#{bookingCode}</span>
            </span>
          </div>
        </section>

        {/* Live Progress Stepper Card */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">LIVE PROGRESS</p>

          <div className="flex items-center justify-between relative">
            {/* Step 1: Confirmed */}
            <div className="flex flex-col sm:flex-row items-center gap-2 z-10">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-600 text-white text-xs font-bold shadow-xs">
                ✓
              </span>
              <span className="text-xs font-bold text-teal-800">Confirmed</span>
            </div>

            <div className="flex-1 h-0.5 bg-teal-500 mx-2" />

            {/* Step 2: Notified */}
            <div className="flex flex-col sm:flex-row items-center gap-2 z-10">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-600 text-white text-xs font-bold shadow-xs">
                ✓
              </span>
              <span className="text-xs font-bold text-teal-800">Notified</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

            {/* Step 3: En Route */}
            <div className="flex flex-col sm:flex-row items-center gap-2 z-10">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-300">
                3
              </span>
              <span className="text-xs font-semibold text-slate-500">En Route</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-2 hidden sm:block" />

            {/* Step 4: In Progress */}
            <div className="flex flex-col sm:flex-row items-center gap-2 z-10 hidden sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-300">
                4
              </span>
              <span className="text-xs font-semibold text-slate-500">In Progress</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-2 hidden sm:block" />

            {/* Step 5: Completed */}
            <div className="flex flex-col sm:flex-row items-center gap-2 z-10 hidden sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-300">
                5
              </span>
              <span className="text-xs font-semibold text-slate-500">Completed</span>
            </div>
          </div>
        </section>

        {/* 2-Column Grid: Service Summary & What to Prepare */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Service Summary */}
          <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-900">Service Summary</h2>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              {providerName ? (
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-base font-bold text-slate-700 overflow-hidden shrink-0 border border-slate-200">
                    {providerName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{providerName}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{categoryName} Specialist</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 shrink-0 border border-teal-200 animate-pulse">
                    <span className="text-xl">🔍</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-700">Finding a specialist near you…</h3>
                    <p className="text-[11px] text-teal-600 font-medium animate-pulse">Matching your request with nearby pros</p>
                  </div>
                </div>
              )}
              {providerName && (
                <div className="flex items-center gap-1 text-xs font-bold text-slate-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <span className="text-amber-500">⭐</span> Verified
                </div>
              )}
            </div>


            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Service Type</span>
                <span className="font-bold text-slate-900">{categoryName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Date & Time</span>
                <span className="font-semibold text-slate-800">{formattedDate}</span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-slate-500 font-medium">Service Address</span>
                <span className="font-semibold text-slate-800 text-right max-w-[200px]">{address}</span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                <span className="text-slate-500 font-medium">Estimated Cost</span>
                <span className="text-sm font-extrabold text-teal-600">$95/hr (Estimated 1-2 hrs)</span>
              </div>
            </div>
          </section>

          {/* Right Column: What to Prepare */}
          <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">What to Prepare</h2>

              <ul className="space-y-3 text-xs text-slate-600 font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-600 font-bold shrink-0">✓</span>
                  <span>Clear workspace surrounding the water heater or drain access points.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-600 font-bold shrink-0">✓</span>
                  <span>Ensure a household member is present to authorize and guide the specialist.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-600 font-bold shrink-0">✓</span>
                  <span>Secure pets safely in another room during the service duration.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-teal-600 font-bold shrink-0">✓</span>
                  <span>Prepare a clear description or answer any questions about the appliance age/brand.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                to={`/track/${bookingId || '1'}`}
                className="block w-full rounded-2xl bg-teal-600 hover:bg-teal-700 py-3.5 text-center text-xs font-bold text-white shadow-sm transition"
              >
                Track Provider Real-Time
              </Link>

              <button
                type="button"
                onClick={() => alert(`Calling specialist at: ${booking?.provider?.phone || '+1 (555) 901-4421'}`)}
                className="w-full rounded-2xl border border-slate-200 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Message Provider
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to cancel this booking request?')) {
                      cancelMutation.mutate();
                    }
                  }}
                  disabled={cancelMutation.isPending}
                  className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Booking'}
                </button>
              </div>

            </div>
          </section>
        </div>

        {/* Bottom Back Link */}
        <div className="text-center pt-4">
          <Link to="/" className="text-xs font-bold text-teal-600 hover:underline inline-flex items-center gap-1">
            ← Back to Explore Home
          </Link>
        </div>
      </div>
    </div>
  );
}
