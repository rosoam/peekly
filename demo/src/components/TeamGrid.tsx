import type { TeamMemberData } from '../data';

type TeamGridProps = {
  members: TeamMemberData[];
};

export function TeamGrid({ members }: TeamGridProps) {
  const online = members.filter((m) => m.status === 'online').length;
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850/60 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-50">Team</h2>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            <span className="text-teal-400/90">{online}</span> online · {members.length} total
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-b from-ember-500 to-ember-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-ember-600/30 ring-1 ring-white/10 transition hover:brightness-110 active:translate-y-px"
        >
          + Invite
        </button>
      </header>
      <div className="grid grid-cols-2 gap-1.5 p-3">
        {members.map((m) => (
          <TeamMember key={m.id} member={m} />
        ))}
      </div>
    </section>
  );
}

type TeamMemberProps = {
  member: TeamMemberData;
};

function TeamMember({ member }: TeamMemberProps) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/[0.04]"
    >
      <Avatar initials={member.initials} status={member.status} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">{member.name}</div>
        <div className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-600">{member.role}</div>
      </div>
    </button>
  );
}

type AvatarProps = {
  initials: string;
  status: 'online' | 'away' | 'offline';
};

function Avatar({ initials, status }: AvatarProps) {
  const ring =
    status === 'online'
      ? 'ring-2 ring-teal-400/90 ring-offset-2 ring-offset-ink-850'
      : status === 'away'
        ? 'ring-2 ring-ember-400/80 ring-offset-2 ring-offset-ink-850'
        : 'ring-1 ring-slate-600 ring-offset-2 ring-offset-ink-850';
  return (
    <div className="relative shrink-0">
      <div
        className={
          'flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-800 text-xs font-bold text-slate-100 ' +
          ring
        }
      >
        {initials}
      </div>
    </div>
  );
}
