type HeaderProps = {
  title: string;
  user: { name: string; initials: string };
  notificationsCount?: number;
};

export function Header({ title, user, notificationsCount = 0 }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-sm font-bold">
          A
        </div>
        <span className="font-semibold text-slate-100 tracking-tight">Acme Inc.</span>
        <span className="text-slate-500">/</span>
        <span className="text-slate-300">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative w-9 h-9 rounded-lg hover:bg-white/[0.05] flex items-center justify-center text-slate-300"
          aria-label="Notifications"
        >
          <span className="text-base">🔔</span>
          {notificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
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
      className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-white/[0.05] transition"
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold text-white">
        {initials}
      </div>
      <span className="text-sm text-slate-200 font-medium">{name}</span>
      <span className="text-slate-500 text-xs">▾</span>
    </button>
  );
}
