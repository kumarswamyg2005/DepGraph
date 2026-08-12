import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTopPackages, getBusFactor, getHealth } from '../lib/api';
import { LoadingSkeleton, ErrorState, DbUnavailableState } from '../components/LoadingSkeleton';
import { EcoBadge, RiskBadge } from '../components/StatusBadge';
import { useDbStatus } from '../hooks/useDbStatus';

export function Home() {
  const { connected, loading: dbLoading } = useDbStatus();
  const [topPkgs, setTopPkgs] = useState([]);
  const [busFactor, setBusFactor] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (connected === false) {
      setLoading(false);
      return;
    }
    if (connected === null) return; // still checking

    Promise.all([getTopPackages(10), getBusFactor()]).then(([top, bf]) => {
      if (top.error) { setError(top.error); }
      else { setTopPkgs(top.data || []); }
      setBusFactor((bf.data || []).slice(0, 5));
      setLoading(false);
    });
  }, [connected]);

  if (dbLoading || (connected === null && loading)) {
    return (
      <div className="p-6 space-y-6">
        <LoadingSkeleton type="card" />
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (connected === false) return <DbUnavailableState />;

  return (
    <div className="p-6 fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-base font-semibold text-text-primary mb-1">
          Supply Chain Overview
        </h1>
        <p className="text-sm text-text-muted">
          Graph-powered OSS dependency risk explorer · powered by CognoDB
        </p>
      </div>

      {/* Quick-nav cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            to: '/packages',
            icon: '⛓',
            title: 'Dep Explorer',
            color: 'text-safe',
            desc: 'Transitive closure & shortest path',
          },
          {
            to: '/bus-factor',
            icon: '⚠',
            title: 'Bus Factor',
            color: 'text-warn',
            desc: 'Single-maintainer risk ranking',
          },
          {
            to: '/blast-radius',
            icon: '◉',
            title: 'Blast Radius',
            color: 'text-risk',
            desc: 'Account compromise impact analysis',
          },
        ].map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="panel p-4 hover:border-border-muted transition-colors cursor-pointer block"
          >
            <div className={`text-xl font-mono mb-2 ${card.color}`}>{card.icon}</div>
            <div className="text-sm font-semibold text-text-primary mb-1">{card.title}</div>
            <div className="text-xs text-text-muted">{card.desc}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Top packages by transitive dependents */}
        <div className="panel">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e2e' }}>
            <div>
              <div className="text-xs font-semibold text-text-primary">Top Load-Bearing Packages</div>
              <div className="text-2xs text-text-dim font-mono mt-0.5">by transitive dependent count</div>
            </div>
            <Link to="/bus-factor" className="text-2xs text-info hover:underline font-mono">
              view all →
            </Link>
          </div>
          {loading ? (
            <LoadingSkeleton rows={8} />
          ) : error ? (
            <ErrorState error={error} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Package</th>
                  <th>Eco</th>
                  <th>Dependents</th>
                  <th>Maintainers</th>
                </tr>
              </thead>
              <tbody>
                {topPkgs.map((pkg, i) => (
                  <tr
                    key={pkg.id}
                    className="cursor-pointer hover:bg-bg-subtle/50 transition-colors"
                    onClick={() => window.location.href = `/packages?name=${encodeURIComponent(pkg.name)}`}
                  >
                    <td className="text-text-dim font-mono text-xs">{i + 1}</td>
                    <td>
                      <span className="font-mono text-xs text-text-primary font-medium hover:underline">{pkg.name}</span>
                    </td>
                    <td><EcoBadge ecosystem={pkg.ecosystem} /></td>
                    <td className="font-mono text-xs text-warn font-semibold">{pkg.transitiveDepCount}</td>
                    <td>
                      <span className={`font-mono text-xs ${pkg.maintainerCount === 1 ? 'text-risk font-semibold' : 'text-safe'}`}>
                        {pkg.maintainerCount}
                        {pkg.maintainerCount === 1 && ' ⚠'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          )}
        </div>

        {/* Bus factor alerts */}
        <div className="panel">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #1e1e2e' }}>
            <div className="text-xs font-semibold text-text-primary">Bus Factor Alerts</div>
            <div className="text-2xs text-text-dim font-mono mt-0.5">single-maintainer critical packages</div>
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} />
          ) : (
            <div className="divide-y" style={{ borderColor: '#1e1e2e' }}>
              {busFactor.map((pkg) => (
                <div key={pkg.id} className="px-4 py-3 hover:bg-bg-raised transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs text-text-primary truncate">{pkg.name}</span>
                    <RiskBadge level="high" />
                  </div>
                  <div className="flex items-center gap-2 text-2xs text-text-dim font-mono">
                    <EcoBadge ecosystem={pkg.ecosystem} />
                    <span>sole maintainer: <span className="text-warn">{pkg.soloMaintainer}</span></span>
                  </div>
                  {pkg.dependentRepoCount > 0 && (
                    <div className="text-2xs text-text-dim font-mono mt-0.5">
                      {pkg.dependentRepoCount} repo{pkg.dependentRepoCount !== 1 ? 's' : ''} depend on this
                    </div>
                  )}
                </div>
              ))}
              {busFactor.length === 0 && (
                <div className="px-4 py-6 text-center text-text-dim text-xs font-mono">
                  No bus-factor packages detected
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Graph explanation */}
      <div className="panel mt-4 p-4">
        <div className="text-xs font-semibold text-text-primary mb-3">Why a Graph Database?</div>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: '⛓',
              title: 'Multi-hop traversal',
              color: 'text-safe',
              body: 'Transitive dependency resolution at depth N is a recursive closure — trivial in Cypher (*1..5), a recursive CTE nightmare in SQL.',
            },
            {
              icon: '◉',
              title: 'Bus factor / blast radius',
              color: 'text-risk',
              body: 'Finding shared neighbors across variable-length paths is a join explosion in SQL, a single pattern match in Cypher.',
            },
            {
              icon: '⬡',
              title: 'Shape, not aggregates',
              color: 'text-info',
              body: 'The interesting output is the shape of connections — chains, clusters, single points of failure — not aggregates over rows.',
            },
          ].map((item) => (
            <div key={item.title} className="panel-raised p-3">
              <div className={`font-mono text-lg mb-2 ${item.color}`}>{item.icon}</div>
              <div className="text-xs font-semibold text-text-primary mb-1">{item.title}</div>
              <div className="text-2xs text-text-muted leading-relaxed">{item.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
