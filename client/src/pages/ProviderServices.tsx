import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ProviderProfile, ServiceCategory } from '../types';

export default function ProviderServices() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('Electrician');
  const [hourlyRate, setHourlyRate] = useState(500);
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>(['Wiring', 'Circuit Repairs', 'Installation']);
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch categories from backend
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  // Fetch provider's existing profile
  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['provider-me'],
    queryFn: async () => {
      try {
        return await api.get<{ profile: ProviderProfile }>('/api/providers/me');
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (profileData?.profile) {
      const p = profileData.profile;
      if (p.category) setCategory(p.category);
      if (p.hourlyRate) setHourlyRate(p.hourlyRate);
      if (p.skills && p.skills.length > 0) setSkills(p.skills);
      if (p.idDocumentUrl) setIdDocumentUrl(p.idDocumentUrl);
    }
  }, [profileData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (profileData?.profile) {
        // Update existing profile
        return api.put<{ profile: ProviderProfile }>('/api/providers/me', {
          category,
          skills,
          hourlyRate: Number(hourlyRate),
          idDocumentUrl,
        });
      } else {
        // Create new provider profile
        return api.post<{ profile: ProviderProfile }>('/api/providers', {
          category,
          skills,
          hourlyRate: Number(hourlyRate),
          idDocumentUrl,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-me'] });
      setSuccessMsg('✓ Provider service details and skills saved successfully!');
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save profile settings');
      setSuccessMsg('');
    },
  });

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">PRO SERVICES CONFIGURATION</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Services & Pricing Setup</h1>
            <p className="mt-1 text-xs text-slate-500">Specify your trade category, skills, and hourly pricing for customers.</p>
          </div>
          <Link to="/provider" className="text-xs font-semibold text-primary hover:underline">
            ← Back to Console
          </Link>
        </div>

        {successMsg && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Verification & Active Status</h3>
              <p className="text-xs text-slate-500">Your profile status in search results</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              ✓ {profileData?.profile?.verifiedStatus || 'VERIFIED'}
            </span>
          </div>

          {isLoadingProfile ? (
            <p className="text-xs text-slate-500">Loading service configuration…</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-6"
            >
              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  Primary Service Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 font-medium"
                >
                  {categoriesData?.categories ? (
                    categoriesData.categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Electrician">Electrician</option>
                      <option value="Plumber">Plumber</option>
                      <option value="AC Technician">AC Technician</option>
                      <option value="Carpenter">Carpenter</option>
                      <option value="Mechanic">Mechanic</option>
                      <option value="Cleaner">Cleaner</option>
                      <option value="Appliance Repair">Appliance Repair</option>
                    </>
                  )}
                </select>
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  Hourly Service Rate (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    step="50"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    required
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">This rate will be displayed to customers on search results.</p>
              </div>

              {/* Skills Tags Management */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  Specialized Skills & Services Offered
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    placeholder="Add a skill (e.g. Geyser Repair, Main Switch Wiring)..."
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    + Add Skill
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-primary border border-teal-100"
                    >
                      ✓ {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="ml-1 text-slate-400 hover:text-rose-600 font-bold"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Document URL / Proof */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  ID / Certification Document (Optional)
                </label>
                <input
                  type="text"
                  value={idDocumentUrl}
                  onChange={(e) => setIdDocumentUrl(e.target.value)}
                  placeholder="https://example.com/certification.pdf"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving Configuration…' : 'Save Services & Rates'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
