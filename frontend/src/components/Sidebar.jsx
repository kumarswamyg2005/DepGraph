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
      className="flex flex-col"
      style={{
        width: 220,
        minHeight: '100vh',
        background: '#0d0d14',
        borderRight: '1px solid #1e1e2e',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid #1e1e2e' }}>
        <div className="flex items-center gap-2 mb-1">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <circle cx="8" cy="16" r="6" fill="#22c55e" />
            <circle cx="24" cy="8" r="4" fill="#3b82f6" />
            <circle cx="24" cy="24" r="4" fill="#a855f7" />
            <line x1="14" y1="14" x2="20" y2="10" stroke="#303048" strokeWidth="2" />
            <line x1="14" y1="18" x2="20" y2="22" stroke="#303048" strokeWidth="2" />
          </svg>
          <span className="font-mono font-semibold text-sm text-text-primary tracking-tight">
            DepGraph
          </span>
        </div>
        <div className="text-2xs font-mono text-text-dim leading-tight">
          Supply Chain Trust Graph
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="font-mono text-sm opacity-70">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* DB status */}
      <div
        className="px-4 py-3"
        style={{ borderTop: '1px solid #1e1e2e' }}
      >
        <div className="text-2xs font-mono text-text-dim mb-1.5 uppercase tracking-widest">
          Database
        </div>
        <StatusBadge connected={connected} status={status} loading={loading} />
        <div className="text-2xs font-mono text-text-dim mt-1.5 truncate">
          CognoDB · Neo4j
        </div>
      </div>
    </aside>
  );
}
