import { useState } from 'react';

interface DatePickerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export default function DatePicker({ selectedDate, onSelectDate }: DatePickerProps) {
  // Generate next 7 days
  const [dates] = useState(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push({
        fullDate: d.toISOString().split('T')[0],
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return list;
  });

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
        Select Date
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {dates.map((item) => {
          const isSelected = selectedDate === item.fullDate;
          return (
            <button
              key={item.fullDate}
              type="button"
              onClick={() => onSelectDate(item.fullDate)}
              className={`flex min-w-[70px] flex-col items-center justify-center rounded-xl border py-2.5 px-2 transition ${
                isSelected
                  ? 'border-primary bg-primary text-white font-bold shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className={`text-[10px] uppercase font-medium ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                {item.dayName}
              </span>
              <span className="text-base font-bold my-0.5">{item.dayNumber}</span>
              <span className={`text-[10px] ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                {item.month}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
