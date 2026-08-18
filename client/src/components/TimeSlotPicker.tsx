interface TimeSlotPickerProps {
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
}

const DEFAULT_SLOTS = [
  '09:00 AM - 10:00 AM',
  '10:30 AM - 11:30 AM',
  '01:00 PM - 02:00 PM',
  '02:30 PM - 03:30 PM',
  '04:00 PM - 05:00 PM',
  '05:30 PM - 06:30 PM',
];

export default function TimeSlotPicker({ selectedSlot, onSelectSlot }: TimeSlotPickerProps) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
        Select Time Slot
      </label>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {DEFAULT_SLOTS.map((slot) => {
          const isSelected = selectedSlot === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSelectSlot(slot)}
              className={`rounded-xl border py-2.5 px-3 text-xs font-semibold transition ${
                isSelected
                  ? 'border-primary bg-teal-50 text-primary ring-2 ring-teal-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
}
