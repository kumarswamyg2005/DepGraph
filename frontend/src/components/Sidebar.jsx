import React from 'react';
import { NavLink } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { useDbStatus } from '../hooks/useDbStatus';

const NAV = [
  {
    to: '/',
    label: 'Overview',
    icon: '◈',
    exact: true,
  },
  {
    to: '/packages',
    label: 'Dep Explorer',
    icon: '⛓',
    exact: false,
  },
  {
    to: '/bus-factor',
    label: 'Bus Factor',
    icon: '⚠',
    exact: false,
  },
  {
    to: '/blast-radius',
    label: 'Blast Radius',
    icon: '◉',
    exact: false,
  },
];

export function Sidebar() {
  const { connected, status, loading } = useDbStatus();

  return (
    <aside
      className="flex flex-col flex-shrink-0 z-20"
      style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo Header */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-1">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" className="filter drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
            <circle cx="8" cy="16" r="6" fill="#10b981" />
            <circle cx="24" cy="8" r="4" fill="#38bdf8" />
            <circle cx="24" cy="24" r="4" fill="#c084fc" />
            <line x1="14" y1="14" x2="20" y2="10" stroke="#334155" strokeWidth="2" />
            <line x1="14" y1="18" x2="20" y2="22" stroke="#334155" strokeWidth="2" />
          </svg>
          <span className="font-mono font-bold text-sm text-slate-100 tracking-tight">
            DepGraph
          </span>
        </div>
        <div className="text-2xs font-mono text-slate-400 leading-tight">
          OSS Supply Chain Trust Graph
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="font-mono text-sm opacity-80">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* DB Status footer */}
      <div
        className="px-4 py-3 bg-bg-dark/40"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="text-2xs font-mono text-slate-400 mb-1.5 uppercase tracking-widest">
          Database
        </div>
        <StatusBadge connected={connected} status={status} loading={loading} />
        <div className="text-2xs font-mono text-slate-500 mt-1.5 truncate">
          CognoDB · Neo4j
        </div>
      </div>
    </aside>
  );
}

