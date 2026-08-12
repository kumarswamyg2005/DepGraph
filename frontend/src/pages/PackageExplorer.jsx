import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchPanel } from '../components/SearchPanel';
import { GraphView } from '../components/GraphView';
import { NodeDetail } from '../components/NodeDetail';
import { LoadingSkeleton, EmptyState, ErrorState, DbUnavailableState } from '../components/LoadingSkeleton';
import { EcoBadge } from '../components/StatusBadge';
import { useDbStatus } from '../hooks/useDbStatus';
import { getTransitiveDeps, getDepGraph, getShortestPath } from '../lib/api';

export function PackageExplorer() {
  const { connected } = useDbStatus();
  const [searchParams] = useSearchParams();

  // Query 1 — Transitive Deps
  const [depQuery, setDepQuery] = useState('');
  const [depData, setDepData] = useState(null);
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState(null);

  // Dep graph for visualization
  const [graphData, setGraphData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  // Query 4 — Shortest Path
  const [fromPkg, setFromPkg] = useState('');
  const [toPkg, setToPkg] = useState('');
  const [pathData, setPathData] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState(null);

  // Auto-run if URL query param ?name= is present
  useEffect(() => {
    const nameParam = searchParams.get('name');
    if (nameParam) {
      setDepQuery(nameParam);
      runTransitiveDepsFor(nameParam);
    }
  }, [searchParams]);

  async function runTransitiveDepsFor(targetName) {
    const q = (targetName || depQuery).trim();
    if (!q) return;
    setDepLoading(true);
    setGraphLoading(true);
    setDepError(null);
    setDepData(null);
    setGraphData(null);
    setSelectedNode(null);

    const [deps, graph] = await Promise.all([
      getTransitiveDeps(q),
      getDepGraph(q),
    ]);

    if (deps.error) setDepError(deps.error);
    else setDepData(deps.data);

    if (!graph.error && graph.data) setGraphData(graph.data);

    setDepLoading(false);
    setGraphLoading(false);
  }

  async function runTransitiveDeps() {
    runTransitiveDepsFor(depQuery);
  }


  async function runShortestPath() {
    if (!fromPkg.trim() || !toPkg.trim()) return;
    setPathLoading(true);
    setPathError(null);
    setPathData(null);
    const { data, error } = await getShortestPath(fromPkg.trim(), toPkg.trim());
    if (error) setPathError(error);
    else setPathData(data);
    setPathLoading(false);
  }

  return (
    <div className="p-6 fade-in">
      <div className="mb-5">
        <h1 className="text-base font-semibold text-text-primary mb-1">Dependency Explorer</h1>
        <p className="text-sm text-text-muted">
          Query 1 · Transitive closure (1–5 hops) &nbsp;·&nbsp; Query 4 · Shortest path
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Left: controls + table */}
        <div className="col-span-2 space-y-4">

          {/* Transitive deps */}
          <div className="panel p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-text-primary mb-0.5">
                Transitive Dependency Closure
              </div>
              <div className="text-2xs font-mono text-text-dim">
                DEPENDS_ON *1..5 traversal
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchPanel
                  mode="package"
                  value={depQuery}
                  onChange={setDepQuery}
                  placeholder="e.g. wexa-core"
                  onSelect={(item) => {
                    const n = item.p?.name || item.name;
                    if (n) setDepQuery(n);
                  }}
                />
              </div>
              <button
                id="btn-transitive-run"
                className="btn btn-primary"
                disabled={!depQuery.trim() || depLoading}
                onClick={runTransitiveDeps}
              >
                {depLoading ? '...' : 'Run'}
              </button>
            </div>

            {/* Cypher preview */}
            <div className="panel-raised px-3 py-2">
              <pre className="text-2xs font-mono text-text-dim whitespace-pre-wrap leading-relaxed">
{`MATCH (p:Package {name: $name})
  -[:DEPENDS_ON*1..5]->(dep:Package)
RETURN DISTINCT dep.name, dep.ecosystem`}
              </pre>
            </div>
          </div>

          {/* Results table */}
          {depLoading && <LoadingSkeleton rows={5} />}
          {depError && <ErrorState error={depError} />}
          {depData && !depLoading && (
            <div className="panel">
              <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <span className="text-xs font-mono text-text-dim">
                  {depData.length} transitive dep{depData.length !== 1 ? 's' : ''}
                </span>
                <span className="text-2xs font-mono text-text-dim">for: <span className="text-safe">{depQuery}</span></span>
              </div>
              {depData.length === 0 ? (
                <EmptyState message="No transitive dependencies found" detail="This package has no downstream dependencies at depth 1–5" />
              ) : (
                <div className="overflow-auto max-h-60">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Eco</th>
                        <th>Ver</th>
                        <th>Depth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depData.map((pkg, i) => (
                        <tr
                          key={i}
                          className="cursor-pointer hover:bg-bg-subtle/50 transition-colors"
                          onClick={() =>
                            setSelectedNode({
                              id: pkg.id || `pkg-${pkg.name}`,
                              name: pkg.name,
                              type: 'Package',
                              ecosystem: pkg.ecosystem,
                              version: pkg.version,
                              depth: pkg.depth,
                            })
                          }
                        >
                          <td className="font-mono text-xs text-text-primary">{pkg.name}</td>
                          <td><EcoBadge ecosystem={pkg.ecosystem} /></td>
                          <td className="font-mono text-2xs text-text-dim">
                            {pkg.version ? `v${pkg.version}` : '—'}
                          </td>
                          <td className="font-mono text-xs text-warn">{pkg.depth}</td>
                          <td>
                            <button
                              className="text-2xs font-mono text-info hover:underline px-1.5 py-0.5 rounded bg-info/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDepQuery(pkg.name);
                                runTransitiveDepsFor(pkg.name);
                              }}
                              title="Explore this package graph"
                            >
                              Explore →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Shortest Path */}
          <div className="panel p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-text-primary mb-0.5">
                Shortest Dependency Path
              </div>
              <div className="text-2xs font-mono text-text-dim">
                shortestPath() — why JOINs don't scale
              </div>
            </div>
            <div className="space-y-2">
              <SearchPanel
                mode="package"
                value={fromPkg}
                onChange={setFromPkg}
                placeholder="From package..."
                onSelect={(item) => {
                  const n = item.p?.name || item.name;
                  if (n) setFromPkg(n);
                }}
              />
              <div className="text-center text-text-dim font-mono text-xs">↓</div>
              <SearchPanel
                mode="package"
                value={toPkg}
                onChange={setToPkg}
                placeholder="To package..."
                onSelect={(item) => {
                  const n = item.p?.name || item.name;
                  if (n) setToPkg(n);
                }}
              />
            </div>
            <button
              id="btn-shortest-path-run"
              className="btn btn-primary w-full"
              disabled={!fromPkg.trim() || !toPkg.trim() || pathLoading}
              onClick={runShortestPath}
            >
              {pathLoading ? 'Finding path...' : 'Find Shortest Path'}
            </button>

            <div className="panel-raised px-3 py-2">
              <pre className="text-2xs font-mono text-text-dim whitespace-pre-wrap leading-relaxed">
{`MATCH (a:Package {name: $from}),
      (b:Package {name: $to})
MATCH path = shortestPath(
  (a)-[:DEPENDS_ON*..10]->(b))
RETURN nodes(path), length(path)`}
              </pre>
            </div>

            {pathLoading && <LoadingSkeleton type="card" />}
            {pathError && <ErrorState error={pathError} />}
            {pathData && !pathLoading && (
              <div className="panel-raised p-3">
                <div className="text-2xs font-mono text-text-dim mb-2">
                  path length: <span className="text-warn">{pathData.pathLength} hop{pathData.pathLength !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  {(pathData.pathNodes || []).map((node, i) => (
                    <React.Fragment key={i}>
                      <button
                        className="font-mono text-2xs bg-bg-subtle px-2 py-0.5 rounded text-safe hover:underline hover:bg-safe/10 transition-colors"
                        onClick={() => {
                          setDepQuery(node.name);
                          runTransitiveDepsFor(node.name);
                        }}
                        title={`Explore ${node.name}`}
                      >
                        {node.name}
                      </button>
                      {i < pathData.pathNodes.length - 1 && (
                        <span className="text-text-dim text-2xs font-mono">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {pathData === null && !pathLoading && !pathError && toPkg && fromPkg && (
              <div />
            )}
            {pathData === null && !pathLoading && pathError === null && fromPkg && toPkg && false && (
              <EmptyState message="No path found" detail="These packages are not connected via DEPENDS_ON" />
            )}
          </div>
        </div>

        {/* Right: graph */}
        <div className="col-span-3 space-y-3">
          {selectedNode && (
            <NodeDetail
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onExplore={(pkgName) => {
                setDepQuery(pkgName);
                runTransitiveDepsFor(pkgName);
              }}
            />
          )}

          {graphLoading && <LoadingSkeleton type="graph" />}
          {!graphLoading && !graphData && (
            <div className="graph-container flex items-center justify-center" style={{ height: 520 }}>
              <div className="text-center">
                <div className="text-3xl font-mono text-text-dim mb-3">⛓</div>
                <p className="text-text-muted text-sm">Enter a package name to visualize its dependency graph</p>
                <p className="text-text-dim text-xs mt-1 font-mono">Try: wexa-core, express, requests</p>
              </div>
            </div>
          )}
          {!graphLoading && graphData && (
            <GraphView
              graphData={graphData}
              height={520}
              onNodeClick={setSelectedNode}
              focusNodeId={selectedNode?.id || selectedNode?.name}
            />
          )}

          {!graphLoading && depData && depData.length === 0 && !graphData && (
            <EmptyState message="No graph to display" detail="Package has no transitive dependencies" />
          )}
        </div>
      </div>
    </div>
  );
}
