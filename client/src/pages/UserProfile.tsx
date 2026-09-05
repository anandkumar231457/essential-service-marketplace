import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function UserProfile() {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'payments' | 'notifications' | 'security' | 'support'>('profile');

  // Form states
  const [name, setName] = useState(user?.name || 'Anna Kovac');
  const [email, setEmail] = useState(user?.email || 'anna.kovac@example.com');
  const [phone, setPhone] = useState(user?.phone || '+1 (555) 901-4421');
  const [memberSince, setMemberSince] = useState('October 2024');
  
  // Notification toggle states
  const [notifyBooking, setNotifyBooking] = useState(true);
  const [notifyTracking, setNotifyTracking] = useState(true);
  const [notifyPromos, setNotifyPromos] = useState(false);

  // Preferred services states
  const [preferredServices, setPreferredServices] = useState<string[]>(['Plumbing', 'Electrical']);

  // Saved addresses state
  const [addresses, setAddresses] = useState([
    { id: '1', tag: 'Home', line1: '450 Sutter St, Apt 405', line2: 'San Francisco, CA 94108' },
    { id: '2', tag: 'Work', line1: '100 Pine St, Floor 12', line2: 'San Francisco, CA 94111' },
  ]);

  // Saved cards state
  const [cards, setCards] = useState([
    { id: '1', type: 'Visa', last4: '4390', exp: '12/29' },
    { id: '2', type: 'Master card', last4: '8821', exp: '05/28' },
  ]);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Fetch latest user details from server
    api
      .get<{ user: any }>('/api/users/me')
      .then((res) => {
        if (res.user) {
          if (res.user.name) setName(res.user.name);
          if (res.user.email) setEmail(res.user.email);
          if (res.user.phone) setPhone(res.user.phone);
          if (res.user.createdAt) {
            const date = new Date(res.user.createdAt);
            setMemberSince(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
          }
          updateUser(res.user);
        }
      })
      .catch(() => {});
  }, [updateUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await api.put<{ user: any }>('/api/users/me', {
        name,
        phone,
        email,
      });
      updateUser(res.user);
      setSavedMsg('✓ Profile settings updated successfully!');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const togglePreferredService = (service: string) => {
    if (preferredServices.includes(service)) {
      setPreferredServices(preferredServices.filter((s) => s !== service));
    } else {
      setPreferredServices([...preferredServices, service]);
    }
  };

  const removeAddress = (id: string) => {
    setAddresses(addresses.filter((a) => a.id !== id));
  };

  const removeCard = (id: string) => {
    setCards(cards.filter((c) => c.id !== id));
  };

  return (
    <div className="bg-[#f7fafb] px-4 py-10 sm:px-6 lg:px-8 pb-24 md:pb-16 min-h-screen">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-[260px_1fr]">
          {/* Left Sidebar Navigation */}
          <aside className="space-y-1">
            <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm space-y-1">
              {[
                { id: 'profile', label: 'My Profile' },
                { id: 'addresses', label: 'Saved Addresses' },
                { id: 'payments', label: 'Payment Methods' },
                { id: 'notifications', label: 'Notification Setup' },
                { id: 'security', label: 'Security & Password' },
                { id: 'support', label: 'Help & Support' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full rounded-xl px-4 py-3 text-left text-xs font-bold transition flex items-center justify-between ${
                    activeTab === tab.id
                      ? 'bg-[#E6F7F5] text-teal-800 font-extrabold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {activeTab === tab.id && <span className="h-1.5 w-1.5 rounded-full bg-teal-600"></span>}
                </button>
              ))}
            </div>
          </aside>

          {/* Right Main Content Area */}
          <main className="space-y-6">
            {savedMsg && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-pulse">
                <span>✓</span> {savedMsg}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            {/* CARD 1: Personal Profile */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-900">Personal Profile</h2>

              <div className="flex items-center gap-5">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-tr from-teal-600 to-teal-400 text-xl font-bold text-white shadow-sm overflow-hidden shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => alert('Profile photo upload dialog')}
                    className="rounded-xl border border-teal-600 px-4 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 transition"
                  >
                    Change Photo
                  </button>
                  <p className="text-[11px] text-slate-400 font-medium">JPG, PNG format • Max file size 5MB</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Member Since</label>
                    <input
                      type="text"
                      value={memberSince}
                      disabled
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-teal-600 hover:bg-teal-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>

            {/* CARD 2: Saved Addresses */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Saved Addresses</h2>
                <button
                  type="button"
                  onClick={() => {
                    const newAddr = prompt('Enter new address:');
                    if (newAddr) {
                      setAddresses([...addresses, { id: Date.now().toString(), tag: 'Other', line1: newAddr, line2: 'San Francisco, CA' }]);
                    }
                  }}
                  className="text-xs font-bold text-teal-600 hover:underline flex items-center gap-1"
                >
                  + Add New Address
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div key={addr.id} className="rounded-2xl border border-slate-100 p-4 space-y-2 bg-[#FAFDFD] relative">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#E6F7F5] px-2.5 py-0.5 text-[10px] font-extrabold text-teal-800">
                        {addr.tag}
                      </span>
                      <div className="text-[11px] text-slate-400 font-medium space-x-1.5">
                        <button type="button" onClick={() => removeAddress(addr.id)} className="hover:text-rose-600">
                          Edit / Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{addr.line1}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{addr.line2}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* CARD 3: Saved Payment Methods */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Saved Payment Methods</h2>
                <button
                  type="button"
                  onClick={() => alert('Add card modal')}
                  className="text-xs font-bold text-teal-600 hover:underline flex items-center gap-1"
                >
                  + Add New Card
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cards.map((card) => (
                  <div key={card.id} className="rounded-2xl border border-slate-100 p-4 bg-[#FAFDFD] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold text-teal-800 bg-[#E6F7F5] px-2.5 py-1 rounded-md">
                        {card.type}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">•••• •••• •••• {card.last4}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Exp: {card.exp}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* CARD 4: Notification Preferences */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-slate-900">Notification Preferences</h2>

              <div className="space-y-4">
                {/* Toggle 1 */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Booking Confirmation updates</h3>
                    <p className="text-[11px] text-slate-500">Receive email and push alerts when a pro accepts your request.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyBooking(!notifyBooking)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      notifyBooking ? 'bg-teal-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifyBooking ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Toggle 2 */}
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Specialist real-time tracking logs</h3>
                    <p className="text-[11px] text-slate-500">Get SMS updates when your service pro is en route.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyTracking(!notifyTracking)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      notifyTracking ? 'bg-teal-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifyTracking ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Toggle 3 */}
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Promotions & Discounts</h3>
                    <p className="text-[11px] text-slate-500">Periodic coupons and seasonal discounts for home maintenance.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyPromos(!notifyPromos)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      notifyPromos ? 'bg-teal-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notifyPromos ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </section>

            {/* CARD 5: Your Preferred Services */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Your Preferred Services</h2>

              <div className="flex flex-wrap gap-2.5">
                {['Plumbing', 'Electrical', 'Cleaning', 'AC Repair', 'Auto Mobile'].map((service) => {
                  const isSelected = preferredServices.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => togglePreferredService(service)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                        isSelected
                          ? 'bg-[#E6F7F5] border border-teal-400 text-teal-800'
                          : 'border border-slate-200 text-slate-600 hover:border-teal-200 bg-white'
                      }`}
                    >
                      {service}
                    </button>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
