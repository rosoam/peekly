import type { ActivityEntry, ActivityKind } from '../data';

type ActivityFeedProps = {
  entries: ActivityEntry[];
};

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <section className="rounded-xl bg-ink-800/60 border border-white/[0.06]">
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <h2 className="font-semibold text-slate-100">Recent activity</h2>
        <button type="button" className="text-xs text-brand-400 hover:text-brand-500 font-medium">
          View all →
        </button>
      </header>
      <ul className="divide-y divide-white/[0.04]">
        {entries.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

type ActivityItemProps = {
  entry: ActivityEntry;
};

function ActivityItem({ entry }: ActivityItemProps) {
  return (
    <li className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition">
      <KindBadge kind={entry.kind} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200">
          <span className="font-medium text-slate-100">{entry.who}</span>{' '}
          <span className="text-slate-400">{entry.message}</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{entry.ago}</div>
      </div>
    </li>
  );
}

function KindBadge({ kind }: { kind: ActivityKind }) {
  const config: Record<ActivityKind, { color: string; label: string }> = {
    commit: { color: 'bg-violet-500/15 text-violet-300', label: 'commit' },
    deploy: { color: 'bg-emerald-500/15 text-emerald-300', label: 'deploy' },
    issue: { color: 'bg-amber-500/15 text-amber-300', label: 'issue' },
    review: { color: 'bg-sky-500/15 text-sky-300', label: 'review' },
  };
  const { color, label } = config[kind];
  return (
    <span
      className={
        'shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ' + color
      }
    >
      {label}
    </span>
  );
}
