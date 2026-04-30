export type StatTrend = 'up' | 'down' | 'flat';

export type Stat = {
  label: string;
  value: string;
  delta: string;
  trend: StatTrend;
};

export type ActivityKind = 'commit' | 'deploy' | 'issue' | 'review';

export type ActivityEntry = {
  id: string;
  who: string;
  whoInitials: string;
  kind: ActivityKind;
  message: string;
  ago: string;
};

export type TeamMemberData = {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: 'online' | 'away' | 'offline';
};

export const stats: Stat[] = [
  { label: 'Monthly revenue', value: '$48,290', delta: '+12.4%', trend: 'up' },
  { label: 'Active users', value: '1,428', delta: '+184', trend: 'up' },
  { label: 'Uptime', value: '99.97%', delta: '−0.02%', trend: 'down' },
];

export const activity: ActivityEntry[] = [
  { id: 'a1', who: 'Romario Sobreira', whoInitials: 'RS', kind: 'review', message: 'approved PR #234 — refactor billing module', ago: '4m ago' },
  { id: 'a2', who: 'Marie Vincent', whoInitials: 'MV', kind: 'deploy', message: 'shipped v2.4.0 to staging', ago: '12m ago' },
  { id: 'a3', who: 'Jean Cottard', whoInitials: 'JC', kind: 'issue', message: 'opened issue #156 — pagination off-by-one', ago: '38m ago' },
  { id: 'a4', who: 'Sara Köhler', whoInitials: 'SK', kind: 'commit', message: 'pushed 3 commits to main on initer-backend', ago: '1h ago' },
];

export const team: TeamMemberData[] = [
  { id: 't1', name: 'Romario Sobreira', initials: 'RS', role: 'Founder · Engineering', status: 'online' },
  { id: 't2', name: 'Marie Vincent', initials: 'MV', role: 'Product Lead', status: 'online' },
  { id: 't3', name: 'Jean Cottard', initials: 'JC', role: 'Senior Engineer', status: 'away' },
  { id: 't4', name: 'Sara Köhler', initials: 'SK', role: 'Designer', status: 'online' },
  { id: 't5', name: 'Aurélien Petit', initials: 'AP', role: 'DevOps', status: 'offline' },
  { id: 't6', name: 'Léa Martin', initials: 'LM', role: 'Marketing', status: 'online' },
];

export const navItems = [
  { id: 'overview', label: 'Overview', icon: '◧', active: true },
  { id: 'projects', label: 'Projects', icon: '▦', active: false },
  { id: 'team', label: 'Team', icon: '◇', active: false },
  { id: 'inbox', label: 'Inbox', icon: '✉', active: false, badge: 3 },
  { id: 'settings', label: 'Settings', icon: '⚙', active: false },
] as const;
