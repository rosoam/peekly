type HeaderProps = {
  title: string;
  user: { name: string; initials: string };
  notificationsCount?: number;
};

export function Header({ title, user, notificationsCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-white/[0.06] bg-ink-950/75 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-600 text-sm font-bold text-white shadow-lg shadow-ember-600/25 ring-1 ring-white/15">
          A
        </div>
        <div className="hidden h-8 w-px bg-white/[0.08] sm:block" aria-hidden />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-sm font-semibold tracking-tight text-slate-100">Acme</span>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-400">{title}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-400 transition hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-200"
          aria-label="Notifications"
        >
          <span className="text-lg" aria-hidden>
            ◉
          </span>
          {notificationsCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white ring-2 ring-ink-950">
              {notificationsCount}
            </span>
          )}
        </button>
        <UserMenu name={user.name} initials={user.initials} />
      </div>
    </header>
  );
}

function UserMenu({ name, initials }: { name: string; initials: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] py-1.5 pl-2 pr-3 transition hover:border-ember-500/30 hover:bg-ember-500/[0.07]"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-ink-700 to-ink-900 text-xs font-bold text-slate-100 ring-1 ring-white/10">
        {initials}
      </div>
      <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-200 sm:inline">{name}</span>
      <span className="text-xs text-slate-500">▾</span>
    </button>
  );
}
