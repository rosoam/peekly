import { navItems } from '../data';

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/50">
      <nav className="flex flex-col gap-1 p-3">
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
      <div className="mt-auto border-t border-white/[0.06] p-3">
        <div className="relative overflow-hidden rounded-xl border border-ember-500/20 bg-gradient-to-br from-ember-500/[0.12] via-ink-850/80 to-teal-500/[0.06] p-3.5">
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-ember-400/20 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ember-400/90">Peekly</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Hold{' '}
              <kbd className="rounded-md border border-white/[0.1] bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                ⌥
              </kbd>{' '}
              and click any element to inspect its component.
            </p>
          </div>
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
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ' +
        (active
          ? 'bg-gradient-to-r from-ember-500/20 to-transparent font-medium text-ember-200 ring-1 ring-ember-500/25'
          : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200')
      }
    >
      <span
        className={
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ' +
          (active ? 'bg-ember-500/15 text-ember-300' : 'bg-white/[0.03] text-slate-600')
        }
      >
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && (
        <span className="rounded-md bg-ember-500/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ember-200">
          {badge}
        </span>
      )}
    </button>
  );
}
