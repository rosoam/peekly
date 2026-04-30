import type { TeamMemberData } from '../data';

type TeamGridProps = {
  members: TeamMemberData[];
};

export function TeamGrid({ members }: TeamGridProps) {
  return (
    <section className="rounded-xl bg-ink-800/60 border border-white/[0.06]">
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <div>
          <h2 className="font-semibold text-slate-100">Team</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {members.filter((m) => m.status === 'online').length} online of {members.length}
          </p>
        </div>
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition"
        >
          + Invite
        </button>
      </header>
      <div className="grid grid-cols-2 gap-2 p-3">
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
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition text-left group"
    >
      <Avatar initials={member.initials} status={member.status} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-100 truncate">{member.name}</div>
        <div className="text-xs text-slate-500 truncate">{member.role}</div>
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
      ? 'ring-2 ring-emerald-400'
      : status === 'away'
      ? 'ring-2 ring-amber-400'
      : 'ring-1 ring-slate-600';
  return (
    <div className="relative shrink-0">
      <div
        className={
          'w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold text-white ' +
          ring
        }
      >
        {initials}
      </div>
    </div>
  );
}
