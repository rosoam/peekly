type ProviderInfo = {
  id: string;
  label: string;
  status: 'connected' | 'degraded';
  lastSync: string;
};

type ProfileProviderDetailContentProps = {
  orgName: string;
  workspaceSlug: string;
  user: { name: string; initials: string; email: string };
  provider: ProviderInfo;
};

export function ProfileProviderDetailContent({
  orgName,
  workspaceSlug,
  user,
  provider,
}: ProfileProviderDetailContentProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-ink-850/90 via-ink-900/80 to-ink-950/95 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_24px_48px_-24px_rgba(0,0,0,0.7)]">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-ember-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-teal-400/10 blur-3xl"
        aria-hidden
      />

      <header className="relative flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Workspace</p>
          <h2 className="font-display mt-1 text-xl font-semibold tracking-tight text-slate-50">{orgName}</h2>
          <p className="mt-0.5 font-mono text-xs text-ember-400/90">/{workspaceSlug}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={
              'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ' +
              (provider.status === 'connected'
                ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/25'
                : 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30')
            }
          >
            {provider.status === 'connected' ? 'Live' : 'Degraded'}
          </span>
          <span className="text-[10px] text-slate-500">Sync {provider.lastSync}</span>
        </div>
      </header>

      <div className="relative grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-ember-500/40 to-teal-400/20 opacity-80 blur-sm" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-700 to-ink-900 text-lg font-bold text-slate-100 ring-1 ring-white/10">
              {user.initials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{user.name}</p>
            <p className="truncate font-mono text-xs text-slate-500">{user.email}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-slate-600">Primary session</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Auth provider</p>
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 ring-1 ring-white/[0.04]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-sm" aria-hidden>
              ◈
            </span>
            <div className="min-w-0 text-right">
              <p className="text-sm font-medium text-slate-200">{provider.label}</p>
              <p className="font-mono text-[10px] text-slate-500">ID {provider.id}</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-white/[0.05] bg-black/20 px-5 py-3">
        {['API keys', 'Webhooks', 'Audit log'].map((chip) => (
          <button
            key={chip}
            type="button"
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:border-ember-500/35 hover:bg-ember-500/10 hover:text-ember-200"
          >
            {chip}
          </button>
        ))}
      </footer>
    </section>
  );
}
