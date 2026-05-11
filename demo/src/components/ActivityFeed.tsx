import type { ActivityEntry, ActivityKind } from '../data';

type ActivityFeedProps = {
  entries: ActivityEntry[];
};

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850/60 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-50">Recent activity</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-600">Live stream</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-ember-400 transition hover:text-ember-300"
        >
          View all →
        </button>
      </header>
      <ul className="divide-y divide-white/[0.05]">
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
    <li className="flex items-start gap-3 px-5 py-4 transition hover:bg-white/[0.02]">
      <MiniAvatar initials={entry.whoInitials} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={entry.kind} />
          <span className="text-sm font-semibold text-slate-100">{entry.who}</span>
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-500">{entry.message}</p>
        <p className="mt-1.5 font-mono text-[10px] text-slate-600">{entry.ago}</p>
      </div>
    </li>
  );
}

function MiniAvatar({ initials }: { initials: string }) {
  return (
    <div
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 text-[11px] font-bold text-slate-200 ring-1 ring-white/10"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function KindBadge({ kind }: { kind: ActivityKind }) {
  const config: Record<ActivityKind, { color: string; label: string }> = {
    commit: { color: 'bg-violet-500/15 text-violet-200 ring-violet-400/25', label: 'commit' },
    deploy: { color: 'bg-teal-500/15 text-teal-200 ring-teal-400/25', label: 'deploy' },
    issue: { color: 'bg-ember-500/15 text-ember-200 ring-ember-400/20', label: 'issue' },
    review: { color: 'bg-sky-500/15 text-sky-200 ring-sky-400/25', label: 'review' },
  };
  const { color, label } = config[kind];
  return (
    <span
      className={
        'rounded-md px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ring-1 ' + color
      }
    >
      {label}
    </span>
  );
}
