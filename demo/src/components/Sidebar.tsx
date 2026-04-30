import { navItems } from '../data';

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-white/[0.06] bg-ink-900/40 flex flex-col">
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={item.active}
            badge={'badge' in item ? item.badge : undefined}
          />
        ))}
      </nav>
      <div className="mt-auto p-3 border-t border-white/[0.06]">
        <div className="rounded-lg bg-gradient-to-br from-brand-500/10 to-brand-600/5 border border-brand-500/20 p-3">
          <div className="text-xs font-semibold text-brand-400 mb-1">Pro tip</div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Hold <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 text-[10px] font-mono">⌥</kbd>{' '}
            and click any element to peek at its component.
          </p>
        </div>
      </div>
    </aside>
  );
}

type NavItemProps = {
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
};

function NavItem({ label, icon, active, badge }: NavItemProps) {
  return (
    <button
      type="button"
      className={
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ' +
        (active
          ? 'bg-brand-500/15 text-brand-400 font-medium'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200')
      }
    >
      <span className={active ? 'text-brand-400' : 'text-slate-500'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-semibold">
          {badge}
        </span>
      )}
    </button>
  );
}
