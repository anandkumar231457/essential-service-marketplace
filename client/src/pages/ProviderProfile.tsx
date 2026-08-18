import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { ProviderProfile } from '../types';
import StarRating from '../components/StarRating';

type ProfileDetail = ProviderProfile & { user: { name: string; phone: string; email: string } };

export default function ProviderProfilePage() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'about' | 'services' | 'reviews'>('about');

  const { data, isLoading, error } = useQuery({
    queryKey: ['provider', providerId],
    enabled: Boolean(providerId),
    queryFn: () => api.get<{ profile: ProfileDetail }>(`/api/providers/${providerId}`),
  });

  const profile = data?.profile;

  const mockReviews = [
    { id: 1, name: 'Rajesh Sharma', rating: 5, date: '2 days ago', comment: 'Punctual, professional and solved the issue quickly!' },
    { id: 2, name: 'Priya Nair', rating: 5, date: '1 week ago', comment: 'Great service! Very polite and left the place clean.' },
  ];

  return (
    <div className="bg-[#f7fafb] px-5 py-8 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate(-1)} className="text-xs font-semibold text-primary hover:underline">
          ← Back to Search
        </button>

        {isLoading && <p className="mt-8 text-slate-500 text-sm">Loading specialist profile…</p>}
        {error && <p className="mt-8 text-red-600 text-sm">{(error as Error).message}</p>}

        {profile && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            {/* Left Main Profile Info */}
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
                <div className="flex items-start gap-5">
                  <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-teal-50 text-3xl font-bold text-primary">
                    {profile.user.name.charAt(0)}
                    <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-slate-900">{profile.user.name}</h1>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        ✓ Verified Pro
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-slate-500">{profile.category} Specialist</p>
                    <div className="mt-2 flex items-center gap-2">
                      <StarRating rating={profile.avgRating || 5.0} size="md" showCount count={12} />
                      <span className="text-xs text-slate-400">• 5+ Years Exp.</span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mt-8 flex border-b border-slate-100 gap-6 text-sm font-semibold">
                  <button
                    onClick={() => setActiveTab('about')}
                    className={`pb-3 transition ${
                      activeTab === 'about' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    About
                  </button>
                  <button
                    onClick={() => setActiveTab('services')}
                    className={`pb-3 transition ${
                      activeTab === 'services' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Services & Skills
                  </button>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className={`pb-3 transition ${
                      activeTab === 'reviews' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Reviews (12)
                  </button>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                  {activeTab === 'about' && (
                    <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                      <p>
                        Experienced {profile.category.toLowerCase()} professional specializing in residential repairs, maintenance, and installations. Dedicated to providing high-quality workmanship with transparent pricing.
                      </p>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Response Time</p>
                          <p className="font-semibold text-slate-800">Under 30 mins</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Service Area</p>
                          <p className="font-semibold text-slate-800">Bengaluru (Within 15km)</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'services' && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Specialized Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill) => (
                          <span key={skill} className="rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-primary">
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'reviews' && (
                    <div className="space-y-4">
                      {mockReviews.map((rev) => (
                        <div key={rev.id} className="border-b border-slate-50 pb-4">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">{rev.name}</span>
                            <span className="text-xs text-slate-400">{rev.date}</span>
                          </div>
                          <StarRating rating={rev.rating} size="sm" />
                          <p className="mt-2 text-xs text-slate-600">{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right Booking Card */}
            <aside className="h-fit rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">PRICING & BOOKING</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">₹{profile.hourlyRate}</span>
                  <span className="text-xs text-slate-500 font-medium">/ hour</span>
                </div>
              </div>

              <div className="space-y-3 text-xs border-t border-b border-slate-100 py-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Service Guarantee</span>
                  <span className="font-semibold text-slate-800">100% Satisfied</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cancellation Fee</span>
                  <span className="font-semibold text-slate-800">Free before 2 hrs</span>
                </div>
              </div>

              <Link
                to={`/book/${providerId}?category=${encodeURIComponent(profile.category)}`}
                className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-700 shadow-sm"
              >
                Schedule Service Now
              </Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
