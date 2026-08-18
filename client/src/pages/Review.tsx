import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking } from '../types';

export default function Review() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { data } = useQuery({ queryKey: ['booking', bookingId], enabled: Boolean(bookingId), queryFn: () => api.get<{ booking: Booking & { provider?: { name: string }; category?: { name: string } } }>(`/api/bookings/${bookingId}`) });
  const mutation = useMutation({ mutationFn: () => api.post(`/api/bookings/${bookingId}/reviews`, { rating, comment }), onSuccess: () => navigate('/history') });
  return <div className="flex min-h-[70vh] items-center justify-center bg-[#f7fafb] px-5 py-12"><div className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60"><p className="text-center text-sm font-semibold text-primary">SERVICE COMPLETED</p><h1 className="mt-2 text-center text-3xl font-bold text-slate-900">How was your experience?</h1><p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-500">Your feedback helps us maintain a trusted marketplace for every home.</p><div className="mt-8 rounded-2xl bg-slate-50 p-4 text-center"><p className="font-semibold text-slate-800">{data?.booking.category?.name || 'Home service'}</p><p className="mt-1 text-sm text-slate-500">with {data?.booking.provider?.name || 'your professional'}</p></div><div className="mt-8 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} className={`text-4xl transition ${value <= rating ? 'text-amber-400' : 'text-slate-200'}`} aria-label={`${value} stars`}>★</button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} className="mt-8 min-h-32 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-teal-200" placeholder="Tell us a little about the service (optional)" /><button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50">{mutation.isPending ? 'Sending feedback…' : 'Submit review'}</button>{mutation.isError && <p className="mt-3 text-center text-sm text-red-600">{(mutation.error as Error).message}</p>}<Link to="/history" className="mt-5 block text-center text-sm font-semibold text-primary">Maybe later</Link></div></div>;
}
