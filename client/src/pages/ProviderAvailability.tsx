import { useState } from 'react';
import { api } from '../lib/api';
import TimeSlotPicker from '../components/TimeSlotPicker';
import DatePicker from '../components/DatePicker';
import { Link } from 'react-router-dom';

export default function ProviderAvailability() {
  const [available, setAvailable] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('09:00 AM - 10:00 AM');
  const [saved, setSaved] = useState(false);

  const toggleAvailability = async () => {
    const next = !available;
    try {
      await api.post('/api/providers/ping', { lat: 12.9352, lng: 77.6245, isOnline: next });
    } catch {
      // ignore offline mock
    }
    setAvailable(next);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-[#f7fafb] px-5 py-10 lg:px-8 pb-20 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-primary">SCHEDULE MANAGEMENT</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Working Hours & Slots</h1>
          </div>
          <Link to="/provider" className="text-xs font-semibold text-primary hover:underline">
            ← Back to Console
          </Link>
        </div>

        {saved && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800">
            ✓ Availability schedule updated!
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm mb-6 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Instant Online Status</h3>
            <p className="text-xs text-slate-500">Receive immediate dispatch requests nearby</p>
          </div>
          <button
            onClick={toggleAvailability}
            className={`rounded-xl px-5 py-2.5 text-xs font-semibold text-white transition ${
              available ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 hover:bg-slate-500'
            }`}
          >
            {available ? '● Online & Accepting Jobs' : '○ Offline'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">Configure Shift Hours</h3>

          <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          <TimeSlotPicker selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />

          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-teal-700 shadow-sm"
          >
            Save Shift Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
