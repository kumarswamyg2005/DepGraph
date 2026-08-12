import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBusFactor, getTopPackages } from '../lib/api';
import { LoadingSkeleton, EmptyState, ErrorState, DbUnavailableState } from '../components/LoadingSkeleton';
import { EcoBadge, RiskBadge } from '../components/StatusBadge';
import { GraphView } from '../components/GraphView';
import { NodeDetail } from '../components/NodeDetail';
import { useDbStatus } from '../hooks/useDbStatus';

export function BusFactor() {
  const navigate = useNavigate();
  const { connected } = useDbStatus();
  const [busData, setBusData] = useState([]);
  const [topData, setTopData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (connected === false) { setLoading(false); return; }
    if (connected === null) return;

    Promise.all([getBusFactor(), getTopPackages(30)]).then(([bf, top]) => {
      if (bf.error) setError(bf.error);
      else setBusData(bf.data || []);
      setTopData(top.data || []);
      setLoading(false);
    });
  }, [connected]);

  // Build graph data from bus-factor packages (must be before any early return — hooks rules)
  const busFactorGraphData = React.useMemo(() => {
    if (!busData.length) return null;
    const nodes = busData.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      type: 'Package',
      ecosystem: pkg.ecosystem,
      version: pkg.version,
      busFactor: true,
    }));
    const devNodes = busData
      .filter((p) => p.maintainerId && p.soloMaintainer)
      .reduce((acc, p) => {
        if (!acc.find((d) => d.id === p.maintainerId)) {
          acc.push({ id: p.maintainerId, name: p.soloMaintainer, type: 'Developer' });
        }
        return acc;
      }, []);
    const links = busData
      .filter((p) => p.maintainerId)
      .map((p) => ({ source: p.maintainerId, target: p.id, type: 'MAINTAINS' }));

    return { nodes: [...nodes, ...devNodes], links };
  }, [busData]);

  const busFactorIds = busData.map((p) => p.id);

  return (
    <div className="p-6 fade-in">
      {connected === false && <DbUnavailableState />}
      {connected !== false && <>
      <div className="mb-5">
        <h1 className="text-base font-semibold text-text-primary mb-1">Bus Factor Analysis</h1>
        <p className="text-sm text-text-muted">
          Query 2 · Single-maintainer packages ranked by transitive dependent count
        </p>
      </div>

      {/* Cypher */}
      <div className="panel p-3 mb-4">
        <div className="text-2xs font-mono text-text-dim mb-1 uppercase tracking-widest">Query</div>
        <pre className="text-2xs font-mono text-text-muted whitespace-pre-wrap leading-relaxed">
{`MATCH (p:Package)
WITH p, [(dev:Developer)-[:MAINTAINS]->(p) | dev] AS maintainers
WHERE size(maintainers) = 1
OPTIONAL MATCH (repo:Repository)-[:PUBLISHES]->(src:Package)-[:DEPENDS_ON*1..5]->(p)
RETURN p.name, maintainers[0].username AS soloMaintainer,
       count(DISTINCT repo) AS dependentRepoCount
ORDER BY dependentRepoCount DESC`}
        </pre>
      </div>

      {loading ? (
        <LoadingSkeleton rows={10} />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {/* Table */}
          <div className="col-span-2 space-y-3">
            <div className="panel">
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <span className="text-xs font-semibold text-text-primary">
                  At-Risk Packages
                </span>
                <span className="badge badge-risk">{busData.length} flagged</span>
              </div>
              {busData.length === 0 ? (
                <EmptyState message="No bus-factor packages found" detail="All packages have multiple maintainers" />
              ) : (
                <div className="overflow-auto max-h-[520px]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Eco</th>
                        <th>Sole Maintainer</th>
                        <th>Repo Deps</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {busData.map((pkg) => (
                        <tr
                          key={pkg.id}
                          className="cursor-pointer hover:bg-bg-subtle/50 transition-colors"
                          onClick={() =>
                            setSelectedNode({
                              id: pkg.id,
                              name: pkg.name,
                              type: 'Package',
                              ecosystem: pkg.ecosystem,
                              version: pkg.version,
                              busFactor: true,
                            })
                          }
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-risk flex-shrink-0" />
                              <span className="font-mono text-xs text-text-primary truncate max-w-[110px]">
                                {pkg.name}
                              </span>
                            </div>
                          </td>
                          <td><EcoBadge ecosystem={pkg.ecosystem} /></td>
                          <td className="font-mono text-xs text-warn truncate max-w-[70px]">
                            {pkg.soloMaintainer}
                          </td>
                          <td className="font-mono text-xs text-risk">{pkg.dependentRepoCount}</td>
                          <td>
                            <button
                              className="text-2xs font-mono text-info hover:underline px-1.5 py-0.5 rounded bg-info/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/packages?name=${encodeURIComponent(pkg.name)}`);
                              }}
                              title="View Dependency Graph"
                            >
                              Graph →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedNode && (
              <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
            )}

            {/* Top packages table */}
            <div className="panel">
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <div className="text-xs font-semibold text-text-primary">All Packages · Risk View</div>
                <div className="text-2xs font-mono text-text-dim mt-0.5">Query 5 — sorted by transitive dependent count</div>
              </div>
              <div className="overflow-auto max-h-52">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Trans. Deps</th>
                      <th>Maintainers</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topData.map((pkg) => (
                      <tr
                        key={pkg.id}
                        className="cursor-pointer hover:bg-bg-subtle/50 transition-colors"
                        onClick={() =>
                          setSelectedNode({
                            id: pkg.id,
                            name: pkg.name,
                            type: 'Package',
                            ecosystem: pkg.ecosystem,
                            version: pkg.version,
                          })
                        }
                      >
                        <td className="font-mono text-xs text-text-primary truncate max-w-[110px]">{pkg.name}</td>
                        <td className="font-mono text-xs text-warn">{pkg.transitiveDepCount}</td>
                        <td>
                          <span className={`font-mono text-xs ${pkg.maintainerCount === 1 ? 'text-risk' : 'text-safe'}`}>
                            {pkg.maintainerCount}
                            {pkg.maintainerCount === 1 && ' ⚠'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="text-2xs font-mono text-info hover:underline px-1.5 py-0.5 rounded bg-info/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/packages?name=${encodeURIComponent(pkg.name)}`);
                            }}
                            title="View Dependency Graph"
                          >
                            Graph →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Graph */}
          <div className="col-span-3">
            {busFactorGraphData && busFactorGraphData.nodes.length > 0 ? (
              <GraphView
                graphData={busFactorGraphData}
                height={580}
                onNodeClick={setSelectedNode}
                busFactorIds={busFactorIds}
                focusNodeId={selectedNode?.id}
              />
            ) : (
              <div className="graph-container flex items-center justify-center" style={{ height: 580 }}>
                <EmptyState message="No graph data" />
              </div>
            )}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

