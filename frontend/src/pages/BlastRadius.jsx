import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchPanel } from '../components/SearchPanel';
import { GraphView } from '../components/GraphView';
import { NodeDetail } from '../components/NodeDetail';
import { LoadingSkeleton, EmptyState, ErrorState, DbUnavailableState } from '../components/LoadingSkeleton';
import { EcoBadge } from '../components/StatusBadge';
import { useDbStatus } from '../hooks/useDbStatus';
import { getBlastRadius } from '../lib/api';

export function BlastRadius() {
  const { connected } = useDbStatus();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [devQuery, setDevQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Auto-run if URL query param ?username= or ?dev= is present
  useEffect(() => {
    const userParam = searchParams.get('username') || searchParams.get('dev');
    if (userParam) {
      setDevQuery(userParam);
      runForUser(userParam);
    }
  }, [searchParams]);

  async function runForUser(username) {
    const q = (username || devQuery).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedNode(null);
    const { data, error: err } = await getBlastRadius(q);
    if (err) setError(err);
    else setResult(data);
    setLoading(false);
  }

  async function run() {
    runForUser(devQuery);
  }

  // Build graph from blast radius data
  const graphData = React.useMemo(() => {
    if (!result) return null;

    const nodesMap = new Map();
    const links = [];

    // Developer node (center)
    if (result.developer?.id) {
      nodesMap.set(result.developer.id, {
        id: result.developer.id,
        name: result.developer.username || devQuery,
        type: 'Developer',
        fullName: result.developer.name,
        github_url: result.developer.github_url,
      });
    }

    // All reachable packages as nodes
    (result.reachablePackages || []).forEach((pkg) => {
      if (pkg?.id && pkg?.name) {
        nodesMap.set(pkg.id, { ...pkg, type: 'Package' });
      }
    });

    // Co-maintainer developer nodes
    (result.coMaintainers || []).forEach((dev) => {
      if (dev?.id) {
        nodesMap.set(dev.id, {
          id: dev.id,
          name: dev.username,
          type: 'Developer',
          fullName: dev.name,
        });
      }
    });

    // Use server-provided edges (MAINTAINS + DEPENDS_ON) — already validated
    (result.graphEdges || []).forEach((edge) => {
      if (edge?.source && edge?.target && nodesMap.has(edge.source) && nodesMap.has(edge.target)) {
        links.push({ source: edge.source, target: edge.target, type: edge.type || 'MAINTAINS' });
      }
    });

    // Fallback: if no server edges, connect dev → packages directly
    if (links.length === 0 && result.developer?.id) {
      (result.reachablePackages || []).forEach((pkg) => {
        if (pkg?.id && nodesMap.has(pkg.id)) {
          links.push({ source: result.developer.id, target: pkg.id, type: 'MAINTAINS' });
        }
      });
    }

    const nodes = Array.from(nodesMap.values());
    return nodes.length > 0 ? { nodes, links } : null;
  }, [result, devQuery]);

  return (
    <div className="p-6 fade-in">
      {connected === false && <DbUnavailableState />}
      {connected !== false && <>
      <div className="mb-5">
        <h1 className="text-base font-semibold text-text-primary mb-1">Blast Radius Analysis</h1>
        <p className="text-sm text-text-muted">
          Query 3 · If this developer account is compromised — what's exposed?
        </p>
      </div>

      {/* Controls */}
      <div className="panel p-4 mb-4 space-y-3">
        <div className="text-xs font-semibold text-text-primary">Developer Username</div>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchPanel
              mode="developer"
              value={devQuery}
              onChange={setDevQuery}
              placeholder="e.g. ghost-maintainer"
              onSelect={(item) => {
                const u = item.dev?.username || item.username;
                if (u) {
                  setDevQuery(u);
                  runForUser(u);
                }
              }}
              onSubmit={(u) => {
                runForUser(u);
              }}
            />

          </div>
          <button
            id="btn-blast-radius-run"
            className="btn border border-risk/40 text-risk hover:bg-risk/10 font-medium px-4"
            disabled={!devQuery.trim() || loading}
            onClick={run}
          >
            {loading ? '...' : '◉ Analyze'}
          </button>
        </div>

        {/* Cypher */}
        <div className="panel-raised px-3 py-2">
          <pre className="text-2xs font-mono text-text-dim whitespace-pre-wrap leading-relaxed">
{`// Reachable packages (transitive, downstream)
MATCH (dev:Developer {username: $username})
      -[:MAINTAINS]->(p:Package)
      -[:DEPENDS_ON*0..5]->(dep:Package)
RETURN DISTINCT dep

// Co-maintainers (shared blast surface)
MATCH (dev)-[:MAINTAINS]->(p)<-[:MAINTAINS]-(other:Developer)
WHERE other.username <> $username
RETURN DISTINCT other, collect(p.name) AS sharedPackages`}
          </pre>
        </div>
      </div>

      {loading && <LoadingSkeleton rows={8} />}
      {error && <ErrorState error={error} />}

      {result && !loading && result.developer && (
        <div className="grid grid-cols-5 gap-4">
          {/* Left panel: stats + table */}
          <div className="col-span-2 space-y-3">

            {/* Dev info card */}
            <div className="panel p-3 border-l-2 border-l-info">
              <div className="text-2xs font-mono text-info uppercase tracking-widest mb-1">Developer</div>
              <div className="font-mono text-sm font-semibold text-text-primary">{result.developer.username}</div>
              {result.developer.name && (
                <div className="text-xs text-text-muted mt-0.5">{result.developer.name}</div>
              )}
              {result.developer.github_url && (
                <a
                  href={result.developer.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xs font-mono text-info hover:underline mt-1 block"
                >
                  {result.developer.github_url}
                </a>
              )}
            </div>

            {/* Stat counters */}
            <div className="grid grid-cols-2 gap-2">
              <div className="panel p-3 text-center">
                <div className="text-xl font-mono font-bold text-risk">
                  {(result.reachablePackages || []).length}
                </div>
                <div className="text-2xs text-text-muted font-mono mt-0.5">packages exposed</div>
              </div>
              <div className="panel p-3 text-center">
                <div className="text-xl font-mono font-bold text-warn">
                  {(result.coMaintainers || []).length}
                </div>
                <div className="text-2xs text-text-muted font-mono mt-0.5">co-maintainers</div>
              </div>
            </div>

            {/* Reachable packages table */}
            <div className="panel">
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <div className="text-xs font-semibold text-text-primary">Reachable Packages</div>
                <div className="text-2xs font-mono text-text-dim mt-0.5">all packages exposed if account compromised</div>
              </div>
              {(result.reachablePackages || []).length === 0 ? (
                <EmptyState message="No packages reachable" detail="This developer maintains no packages" />
              ) : (
                <div className="overflow-auto max-h-56">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Eco</th>
                        <th>Ver</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.reachablePackages || []).map((pkg, i) => (
                        <tr
                          key={i}
                          className="cursor-pointer hover:bg-bg-subtle/50 transition-colors"
                          onClick={() => setSelectedNode({ ...pkg, type: 'Package' })}
                        >
                          <td className="font-mono text-xs text-text-primary">{pkg.name}</td>
                          <td><EcoBadge ecosystem={pkg.ecosystem} /></td>
                          <td className="font-mono text-2xs text-text-dim">
                            {pkg.version ? `v${pkg.version}` : '—'}
                          </td>
                          <td>
                            <button
                              className="text-2xs font-mono text-info hover:underline px-1.5 py-0.5 rounded bg-info/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/packages?name=${encodeURIComponent(pkg.name)}`);
                              }}
                              title="Explore Dependency Graph"
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

            {/* Co-maintainers */}
            {(result.coMaintainers || []).length > 0 && (
              <div className="panel">
                <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                  <div className="text-xs font-semibold text-text-primary">Co-Maintainers</div>
                  <div className="text-2xs font-mono text-text-dim mt-0.5">share blast surface with this dev</div>
                </div>
                <div className="divide-y" style={{ borderColor: '#1e1e2e' }}>
                  {result.coMaintainers.map((dev, i) => (
                    <div
                      key={i}
                      className="px-4 py-2.5 cursor-pointer hover:bg-bg-subtle/50 transition-colors flex items-center justify-between"
                      onClick={() => setSelectedNode({ id: dev.id, name: dev.username, type: 'Developer', fullName: dev.name })}
                    >
                      <div>
                        <div className="font-mono text-xs text-info font-medium">{dev.username}</div>
                        <div className="text-2xs text-text-dim font-mono mt-0.5">
                          shared: {(dev.sharedPackages || []).join(', ')}
                        </div>
                      </div>
                      <button
                        className="text-2xs font-mono text-warn hover:underline px-1.5 py-0.5 rounded bg-warn/10 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDevQuery(dev.username);
                          runForUser(dev.username);
                        }}
                        title="Analyze Blast Radius"
                      >
                        Analyze →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNode && (
              <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
            )}
          </div>

          {/* Graph */}
          <div className="col-span-3">
            {graphData && graphData.nodes.length > 0 ? (
              <GraphView
                graphData={graphData}
                height={560}
                onNodeClick={setSelectedNode}
                focusNodeId={selectedNode?.id}
              />
            ) : (
              <div className="graph-container flex items-center justify-center" style={{ height: 560 }}>
                <EmptyState message="No graph data available" detail="Developer maintains no packages" />
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && result && result.developer === null && (
        <EmptyState
          message={`Developer "${devQuery}" not found`}
          detail="Check the username spelling or use the typeahead search"
        />
      )}
      </>}
    </div>
  );
}
