interface StatusBadgeProps {
  status: string;
}

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  REQUESTED: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Requested' },
  ACCEPTED: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', label: 'Accepted' },
  EN_ROUTE: { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', label: 'En Route' },
  IN_PROGRESS: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Completed' },
  CANCELLED: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Cancelled' },
  REJECTED: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Rejected' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyle[status] ?? { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}
