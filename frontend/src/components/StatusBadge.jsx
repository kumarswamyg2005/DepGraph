import React from 'react';

/**
 * StatusBadge — shows DB connectivity status in the header
 */
export function StatusBadge({ connected, status, loading }) {
  if (loading) {
    return (
      <span className="flex items-center gap-2 text-xs font-mono text-text-dim">
        <span className="status-dot skeleton w-[6px] h-[6px] rounded-full" />
        checking...
      </span>
    );
  }

  if (connected) {
    return (
      <span className="flex items-center gap-2 text-xs font-mono text-safe">
        <span className="status-dot status-dot-green" />
        connected
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs font-mono text-risk">
      <span className="status-dot status-dot-red" />
      {status === 'error' ? 'db unreachable' : status}
    </span>
  );
}

/**
 * EcoBadge — npm/pypi badge
 */
export function EcoBadge({ ecosystem }) {
  const cls = ecosystem === 'npm' ? 'badge badge-npm' : 'badge badge-pypi';
  return <span className={cls}>{ecosystem}</span>;
}

/**
 * RiskBadge — bus-factor risk indicator
 */
export function RiskBadge({ level = 'high' }) {
  const map = {
    high:   { cls: 'badge badge-risk', label: '⚠ Bus Factor' },
    medium: { cls: 'badge badge-warn', label: '~ Warning' },
  };
  const { cls, label } = map[level] || map.high;
  return <span className={cls}>{label}</span>;
}
