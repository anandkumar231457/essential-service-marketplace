interface EarningsChartProps {
  data: { label: string; amount: number }[];
}

export default function EarningsChart({ data }: EarningsChartProps) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1000);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="font-bold text-slate-900 text-sm mb-4">Earnings Breakdown</h3>
      <div className="flex h-48 items-end gap-3 pt-6 border-b border-slate-100 pb-2">
        {data.map((item, idx) => {
          const heightPercent = (item.amount / maxAmount) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition">
                ₹{item.amount}
              </span>
              <div
                style={{ height: `${Math.max(heightPercent, 8)}%` }}
                className="w-full max-w-[36px] rounded-t-lg bg-teal-500 transition-all group-hover:bg-primary"
              />
              <span className="text-[11px] font-medium text-slate-400 truncate w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
