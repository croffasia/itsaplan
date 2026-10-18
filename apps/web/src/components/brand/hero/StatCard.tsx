import type { ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  chart,
}: {
  label: string;
  value: string;
  chart: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/10 p-3 shadow-lg">
      <div className="h-8">{chart}</div>
      <span className="text-lg leading-none font-semibold text-white tabular-nums">{value}</span>
      <span className="text-[11px] leading-tight text-white/70">{label}</span>
    </div>
  );
}
