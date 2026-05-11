import type { StatTrend } from '../data';

type StatCardProps = {
  label: string;
  value: string;
  delta: string;
  trend: StatTrend;
};

export function StatCard({ label, value, delta, trend }: StatCardProps) {
  const trendStyles =
    trend === 'up'
      ? 'text-teal-300 bg-teal-500/12 ring-teal-400/20'
      : trend === 'down'
        ? 'text-rose-300 bg-rose-500/12 ring-rose-400/20'
        : 'text-slate-400 bg-slate-500/10 ring-white/[0.06]';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850/70 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition hover:border-ember-500/25 hover:shadow-[0_0_0_1px_rgba(249,115,22,0.12)]">
      <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-ember-500/5 blur-2xl transition group-hover:bg-ember-500/10" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
        <span
          className={
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ' + trendStyles
          }
        >
          <span className="font-mono text-[10px]">{trendIcon}</span>
          {delta}
        </span>
      </div>
      <div className="relative mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight text-slate-50">
        {value}
      </div>
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
  const stroke = trend === 'up' ? '#2dd4bf' : trend === 'down' ? '#fda4af' : '#94a3b8';
  return (
    <svg width="108" height="22" className="relative mt-4 opacity-60 transition group-hover:opacity-100" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
