import type { StatTrend } from '../data';

type StatCardProps = {
  label: string;
  value: string;
  delta: string;
  trend: StatTrend;
};

export function StatCard({ label, value, delta, trend }: StatCardProps) {
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400 bg-emerald-500/10'
      : trend === 'down'
      ? 'text-rose-400 bg-rose-500/10'
      : 'text-slate-400 bg-slate-500/10';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  return (
    <article className="rounded-xl bg-ink-800/60 border border-white/[0.06] p-5 hover:border-white/[0.12] transition group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </span>
        <span className={'text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ' + trendColor}>
          <span className="text-[10px]">{trendIcon}</span>
          {delta}
        </span>
      </div>
      <div className="text-3xl font-bold text-slate-100 tabular-nums tracking-tight">{value}</div>
      <Sparkline trend={trend} />
    </article>
  );
}

function Sparkline({ trend }: { trend: StatTrend }) {
  const points =
    trend === 'up'
      ? '0,18 12,16 24,14 36,15 48,12 60,9 72,11 84,7 96,5 108,3'
      : trend === 'down'
      ? '0,5 12,7 24,6 36,9 48,11 60,10 72,13 84,15 96,14 108,17'
      : '0,10 12,11 24,9 36,11 48,10 60,11 72,10 84,11 96,10 108,11';
  const stroke = trend === 'up' ? '#6ee7b7' : trend === 'down' ? '#fda4af' : '#94a3b8';
  return (
    <svg width="108" height="22" className="mt-3 opacity-70 group-hover:opacity-100 transition">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
