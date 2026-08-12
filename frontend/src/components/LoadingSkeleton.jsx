import React from 'react';

export function LoadingSkeleton({ rows = 5, type = 'table' }) {
  if (type === 'table') {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-4 rounded" style={{ width: `${40 + (i % 3) * 15}%` }} />
            <div className="skeleton h-4 rounded w-16" />
            <div className="skeleton h-4 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'graph') {
    return (
      <div className="graph-container flex items-center justify-center" style={{ height: 480 }}>
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton rounded-full"
                style={{
                  width: 32 + i * 12,
                  height: 32 + i * 12,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <p className="text-text-dim text-xs font-mono">Building graph...</p>
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="panel p-4 space-y-3">
        <div className="skeleton h-5 rounded w-2/3" />
        <div className="skeleton h-3 rounded w-full" />
        <div className="skeleton h-3 rounded w-4/5" />
        <div className="flex gap-2 mt-2">
          <div className="skeleton h-5 rounded w-16" />
          <div className="skeleton h-5 rounded w-20" />
        </div>
      </div>
    );
  }

  return null;
}

export function DbUnavailableState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="text-4xl font-mono text-risk">×</div>
      <div className="text-center">
        <p className="text-text-primary font-semibold mb-1">Database Unavailable</p>
        <p className="text-text-muted text-sm max-w-xs text-center">
          Cannot reach the CognoDB instance. Check your{' '}
          <span className="font-mono text-text-primary">COGNODB_URI</span> env var and ensure the
          backend is running.
        </p>
      </div>
      <div className="badge badge-risk risk-pulse">db unreachable</div>
    </div>
  );
}

export function EmptyState({ message = 'No results found', detail }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="text-3xl font-mono text-text-dim">∅</div>
      <div className="text-center">
        <p className="text-text-muted text-sm">{message}</p>
        {detail && <p className="text-text-dim text-xs mt-1">{detail}</p>}
      </div>
    </div>
  );
}

export function ErrorState({ error }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="text-3xl font-mono text-risk">!</div>
      <div className="text-center">
        <p className="text-text-primary text-sm font-medium">Query error</p>
        <p className="text-text-muted text-xs mt-1 font-mono">{error}</p>
      </div>
    </div>
  );
}
