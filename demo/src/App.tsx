import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ActivityFeed } from './components/ActivityFeed';
import { TeamGrid } from './components/TeamGrid';
import { ProfileProviderDetailContent } from './components/ProfileProviderDetailContent';
import { activity, stats, team } from './data';

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        title="Project Dashboard"
        user={{ name: 'Romario Sobreira', initials: 'RS' }}
        notificationsCount={3}
      />
      <div className="flex flex-1">
        <Sidebar />
        <Main />
      </div>
    </div>
  );
}

function Main() {
  return (
    <main className="relative flex-1 p-6 pb-10 lg:max-w-[1180px]">
      <div className="mb-8 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ember-500/90">Today</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Overview</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Welcome back — revenue, sessions, and team pulse in one glance.
          </p>
        </div>
        <DateRangePicker />
      </div>

      <div
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        style={{ animationDelay: '60ms' }}
      >
        {stats.map((stat, i) => (
          <div key={stat.label} className="animate-fade-up" style={{ animationDelay: `${80 + i * 70}ms` }}>
            <StatCard label={stat.label} value={stat.value} delta={stat.delta} trend={stat.trend} />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="animate-fade-up-slow" style={{ animationDelay: '200ms' }}>
          <ActivityFeed entries={activity} />
        </div>
        <div className="flex animate-fade-up-slow flex-col gap-5" style={{ animationDelay: '280ms' }}>
          <ProfileProviderDetailContent
            orgName="Acme Inc."
            workspaceSlug="acme-prod"
            user={{
              name: 'Romario Sobreira',
              initials: 'RS',
              email: 'romario@acme.inc',
            }}
            provider={{ id: 'oauth_8f2a', label: 'Google Workspace', status: 'connected', lastSync: '2m ago' }}
          />
          <TeamGrid members={team} />
        </div>
      </div>
    </main>
  );
}

function DateRangePicker() {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-800/90 px-4 py-2.5 text-sm text-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition hover:border-ember-500/40 hover:text-slate-50"
    >
      <span className="text-ember-400/90" aria-hidden>
        ◷
      </span>
      <span className="font-medium">Last 30 days</span>
      <span className="text-xs text-slate-500">▾</span>
    </button>
  );
}
