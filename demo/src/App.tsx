import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ActivityFeed } from './components/ActivityFeed';
import { TeamGrid } from './components/TeamGrid';
import { activity, stats, team } from './data';

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="Project Dashboard"
        user={{ name: 'Romario', initials: 'RS' }}
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
    <main className="flex-1 p-6 max-w-[1100px]">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Welcome back. Here's what's happening today.</p>
        </div>
        <DateRangePicker />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            trend={stat.trend}
          />
        ))}
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <ActivityFeed entries={activity} />
        <TeamGrid members={team} />
      </div>
    </main>
  );
}

function DateRangePicker() {
  return (
    <button
      type="button"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800/80 border border-white/[0.08] hover:border-white/[0.16] text-sm text-slate-300 transition"
    >
      <span className="text-slate-500">📅</span>
      <span>Last 30 days</span>
      <span className="text-slate-500 text-xs">▾</span>
    </button>
  );
}
