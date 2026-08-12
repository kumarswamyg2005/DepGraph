import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EcoBadge, RiskBadge } from './StatusBadge';

/**
 * NodeDetail — sidebar panel showing clicked graph node details
 */
export function NodeDetail({ node, onClose }) {
  const navigate = useNavigate();
  if (!node) return null;

  const colorMap = {
    Package:     'text-safe',
    Developer:   'text-info',
    Repository:  'text-purple-400',
    Organization:'text-orange-400',
  };
  const color = colorMap[node.type] || 'text-text-muted';

  const isPackage = node.type === 'Package' || node.busFactor || (node.name && !node.fullName && !node.github_url);
  const isDeveloper = node.type === 'Developer' || node.soloMaintainer || node.github_url;

  return (
    <div className="panel p-4 space-y-3 fade-in border border-border-subtle shadow-xl bg-bg-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-2xs font-mono uppercase tracking-widest ${color} mb-1`}>
            {node.type || 'Node'}
          </div>
          <div className="font-mono text-sm font-medium text-text-primary break-all">
            {node.name || node.id}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-text-muted text-lg leading-none flex-shrink-0 mt-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="sep" />

      {/* Package-specific details */}
      {isPackage && (
        <div className="space-y-2">
          {node.ecosystem && <EcoBadge ecosystem={node.ecosystem} />}
          {node.version && (
            <div className="flex justify-between text-xs">
              <span className="text-text-dim font-mono">version</span>
              <span className="font-mono text-text-primary">v{node.version}</span>
            </div>
          )}
          {node.busFactor && (
            <div className="mt-2">
              <RiskBadge level="high" />
              <p className="text-2xs text-text-muted mt-1">
                Single maintainer — high supply-chain risk if this account is compromised.
              </p>
            </div>
          )}
          {node.depth !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-text-dim font-mono">depth</span>
              <span className="font-mono text-warn">{node.depth} hops</span>
            </div>
          )}

          <div className="pt-2">
            <button
              className="btn btn-primary w-full text-xs font-mono py-1.5 flex items-center justify-center gap-1.5"
              onClick={() => {
                const name = node.name || node.id;
                if (name) navigate(`/packages?name=${encodeURIComponent(name)}`);
              }}
            >
              <span>Explore Dependency Graph</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Developer-specific details */}
      {isDeveloper && (
        <div className="space-y-2">
          {node.github_url && (
            <a
              href={node.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-info hover:underline break-all block"
            >
              {node.github_url}
            </a>
          )}
          {node.fullName && (
            <div className="flex justify-between text-xs">
              <span className="text-text-dim font-mono">name</span>
              <span className="text-text-primary">{node.fullName}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              className="btn border border-info/40 text-info hover:bg-info/10 w-full text-xs font-mono py-1.5 flex items-center justify-center gap-1.5"
              onClick={() => {
                const devName = node.name || node.username || node.soloMaintainer || node.id;
                if (devName) navigate(`/blast-radius?username=${encodeURIComponent(devName)}`);
              }}
            >
              <span>Analyze Blast Radius</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Node ID */}
      <div className="pt-1">
        <div className="text-2xs font-mono text-text-dim break-all">
          id: {node.id}
        </div>
      </div>
    </div>
  );
}

