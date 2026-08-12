import express from 'express';
import { withSession, serializeRecord, toNumber } from '../db.js';

const router = express.Router();

// ── Query 1: Transitive Dependency Closure ────────────────────────────────────
// Given a package name, return all transitive dependencies up to depth 5.
// Multi-hop traversal: trivial in Cypher, painful recursive CTE in SQL.
router.get('/transitive-deps', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing ?name= parameter', data: [] });

  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (p:Package {name: $name})-[r:DEPENDS_ON*1..5]->(dep:Package)
       RETURN DISTINCT dep.name AS name,
                       dep.ecosystem AS ecosystem,
                       dep.version AS version,
                       dep.description AS description,
                       dep.id AS id,
                       length(r) AS depth`,
      { name }
    );
    return result.records.map((rec) => ({
      name: rec.get('name'),
      ecosystem: rec.get('ecosystem'),
      version: rec.get('version'),
      description: rec.get('description'),
      id: rec.get('id'),
      depth: toNumber(rec.get('depth')),
    }));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [], query: 'transitive-deps' });
});

// ── Query 2: Bus Factor Analysis ──────────────────────────────────────────────
// Packages maintained by exactly ONE developer, ranked by how many repos
// transitively depend on them. Relational-awkward: variable-depth reverse
// traversal + count + filter in one pass.
router.get('/bus-factor', async (req, res) => {
  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (dev:Developer)-[:MAINTAINS]->(p:Package)
       WITH p, count(DISTINCT dev) AS maintainerCount, collect(DISTINCT dev)[0] AS soloMaintainer
       WHERE maintainerCount = 1
       OPTIONAL MATCH (repo:Repository)-[:PUBLISHES]->(src:Package)-[:DEPENDS_ON*1..5]->(p)
       RETURN p.id AS id,
              p.name AS name,
              p.ecosystem AS ecosystem,
              p.version AS version,
              soloMaintainer.username AS soloMaintainer,
              soloMaintainer.id AS maintainerId,
              count(DISTINCT repo) AS dependentRepoCount
       ORDER BY dependentRepoCount DESC, name ASC
       LIMIT 50`
    );
    return result.records.map((rec) => ({
      id: rec.get('id'),
      name: rec.get('name'),
      ecosystem: rec.get('ecosystem'),
      version: rec.get('version'),
      soloMaintainer: rec.get('soloMaintainer'),
      maintainerId: rec.get('maintainerId'),
      dependentRepoCount: toNumber(rec.get('dependentRepoCount')),
    }));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [], query: 'bus-factor' });
});

// ── Query 3: Blast Radius ─────────────────────────────────────────────────────
// Given a developer username: all packages reachable from their maintained
// packages via any dependency chain, PLUS all co-maintainers of any touched
// package — i.e. "if this account is compromised, what's exposed."
router.get('/blast-radius', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Missing ?username= parameter', data: {} });

  const { data, error } = await withSession(async (session) => {
    // Directly maintained packages (always included)
    const directResult = await session.run(
      `MATCH (dev:Developer {username: $username})-[:MAINTAINS]->(p:Package)
       RETURN DISTINCT p.id AS id, p.name AS name,
              p.ecosystem AS ecosystem, p.version AS version`,
      { username }
    );

    // Fetch developer node
    const devResult = await session.run(
      `MATCH (dev:Developer {username: $username}) RETURN dev LIMIT 1`,
      { username }
    );
    if (devResult.records.length === 0) {
      return { developer: null, reachablePackages: [], coMaintainers: [], graphEdges: [] };
    }
    const dev = serializeRecord(devResult.records[0]).dev;

    // Transitive reachable packages (downstream, 1..5 — excludes the directly-maintained themselves)
    const reachableResult = await session.run(
      `MATCH (dev:Developer {username: $username})-[:MAINTAINS]->(p:Package)
       -[:DEPENDS_ON*1..5]->(dep:Package)
       RETURN DISTINCT dep.id AS id, dep.name AS name,
              dep.ecosystem AS ecosystem, dep.version AS version`,
      { username }
    );

    // Co-maintainers: devs who also maintain any package this dev touches
    const coMaintResult = await session.run(
      `MATCH (dev:Developer {username: $username})-[:MAINTAINS]->(p:Package)
              <-[:MAINTAINS]-(other:Developer)
       WHERE other.username <> $username
       RETURN DISTINCT other.id AS id, other.username AS username,
              other.name AS name, other.github_url AS github_url,
              collect(DISTINCT p.name) AS sharedPackages`,
      { username }
    );

    // DEPENDS_ON edges among all reachable packages (for graph edges)
    const edgesResult = await session.run(
      `MATCH (dev:Developer {username: $username})-[:MAINTAINS]->(p:Package)
             -[:DEPENDS_ON*0..5]->(a:Package)-[:DEPENDS_ON]->(b:Package)
       RETURN DISTINCT a.id AS src, b.id AS tgt LIMIT 300`,
      { username }
    );

    // MAINTAINS edges from dev to directly-owned packages
    const maintEdgesResult = await session.run(
      `MATCH (dev:Developer {username: $username})-[:MAINTAINS]->(p:Package)
       RETURN dev.id AS src, p.id AS tgt`,
      { username }
    );

    const directPkgs = directResult.records
      .map((r) => ({ id: r.get('id'), name: r.get('name'), ecosystem: r.get('ecosystem'), version: r.get('version') }))
      .filter((p) => p.id && p.name);

    const reachablePackages = [
      ...directPkgs,
      ...reachableResult.records
        .map((r) => ({ id: r.get('id'), name: r.get('name'), ecosystem: r.get('ecosystem'), version: r.get('version') }))
        .filter((p) => p.id && p.name && !directPkgs.some((d) => d.id === p.id)),
    ];

    const coMaintainers = coMaintResult.records.map((r) => ({
      id: r.get('id'),
      username: r.get('username'),
      name: r.get('name'),
      github_url: r.get('github_url'),
      sharedPackages: r.get('sharedPackages'),
    }));

    const depEdges = edgesResult.records
      .map((r) => ({ source: r.get('src'), target: r.get('tgt'), type: 'DEPENDS_ON' }))
      .filter((e) => e.source && e.target);

    const maintEdges = maintEdgesResult.records
      .map((r) => ({ source: r.get('src'), target: r.get('tgt'), type: 'MAINTAINS' }))
      .filter((e) => e.source && e.target);

    return {
      developer: dev,
      reachablePackages,
      coMaintainers,
      graphEdges: [...maintEdges, ...depEdges],
    };
  });

  if (error) return res.status(503).json({ error, data: {} });
  res.json({ data: data ?? {}, query: 'blast-radius' });
});


// ── Query 4: Shortest Dependency Path ────────────────────────────────────────
// Find the shortest DEPENDS_ON path between two named packages.
// Demonstrates why JOIN chains don't scale: in SQL this requires N self-joins
// or a recursive CTE with no shortest-path semantics.
router.get('/shortest-path', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing ?from= and/or ?to= parameters', data: null });
  }

  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (a:Package {name: $from}), (b:Package {name: $to})
       MATCH path = shortestPath((a)-[:DEPENDS_ON*..10]->(b))
       RETURN [n IN nodes(path) | {id: n.id, name: n.name, ecosystem: n.ecosystem}] AS pathNodes,
              length(path) AS pathLength`,
      { from, to }
    );

    if (result.records.length === 0) return null;
    const rec = result.records[0];
    return {
      pathNodes: rec.get('pathNodes'),
      pathLength: toNumber(rec.get('pathLength')),
    };
  });

  if (error) return res.status(503).json({ error, data: null });
  res.json({ data, query: 'shortest-path' });
});

// ── Query 5: Top Packages by Transitive Dependent Count ──────────────────────
// Rank packages by how many other packages transitively depend on them.
// Great for identifying "load-bearing" packages whose compromise is catastrophic.
router.get('/top-packages', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);

  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (dep:Package)
       OPTIONAL MATCH (src:Package)-[:DEPENDS_ON*1..5]->(dep)
       WITH dep, count(DISTINCT src) AS transitiveDepCount
       OPTIONAL MATCH (dev:Developer)-[:MAINTAINS]->(dep)
       WITH dep, transitiveDepCount, count(DISTINCT dev) AS maintainerCount
       RETURN dep.id AS id,
              dep.name AS name,
              dep.ecosystem AS ecosystem,
              dep.version AS version,
              dep.description AS description,
              transitiveDepCount,
              maintainerCount
       ORDER BY transitiveDepCount DESC
       LIMIT $limit`,
      { limit }
    );
    return result.records.map((rec) => ({
      id: rec.get('id'),
      name: rec.get('name'),
      ecosystem: rec.get('ecosystem'),
      version: rec.get('version'),
      description: rec.get('description'),
      transitiveDepCount: toNumber(rec.get('transitiveDepCount')),
      maintainerCount: toNumber(rec.get('maintainerCount')),
    }));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [], query: 'top-packages' });
});

// ── Graph data for visualization ──────────────────────────────────────────────
// Returns nodes + links for a given package's transitive dep graph
router.get('/dep-graph', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing ?name= parameter', data: null });

  const { data, error } = await withSession(async (session) => {
    const nodesResult = await session.run(
      `MATCH (root:Package {name: $name})
       OPTIONAL MATCH (root)-[r:DEPENDS_ON*1..5]->(dep:Package)
       OPTIONAL MATCH (dev:Developer)-[:MAINTAINS]->(dep)
       OPTIONAL MATCH (dev2:Developer)-[:MAINTAINS]->(root)
       WITH collect(DISTINCT {
              id: dep.id, name: dep.name, type: 'Package',
              ecosystem: dep.ecosystem, version: dep.version
            }) + [{id: root.id, name: root.name, type: 'Package',
                   ecosystem: root.ecosystem, version: root.version}]
            AS pkgNodes,
            collect(DISTINCT {id: dev.id, name: dev.username,
                              type: 'Developer', fullName: dev.name}) AS devNodes1,
            collect(DISTINCT {id: dev2.id, name: dev2.username,
                              type: 'Developer', fullName: dev2.name}) AS devNodes2
       RETURN pkgNodes, devNodes1 + devNodes2 AS devNodes`,
      { name }
    );

    const edgeResult = await session.run(
      `MATCH (root:Package {name: $name})-[:DEPENDS_ON*1..5]->(dep:Package)
       MATCH (a:Package)-[r:DEPENDS_ON]->(b:Package)
       WHERE (a.name = $name OR (root)-[:DEPENDS_ON*1..4]->(a))
         AND (b)-[:DEPENDS_ON*0..4]->(dep)
       RETURN DISTINCT a.id AS source, b.id AS target, 'DEPENDS_ON' AS type LIMIT 300`,
      { name }
    );

    const maintEdgeResult = await session.run(
      `MATCH (root:Package {name: $name})
       OPTIONAL MATCH (root)-[:DEPENDS_ON*0..5]->(dep:Package)
       OPTIONAL MATCH (dev:Developer)-[:MAINTAINS]->(dep)
       RETURN DISTINCT dev.id AS source, dep.id AS target, 'MAINTAINS' AS type`,
      { name }
    );

    if (!nodesResult.records.length) return null;
    const rec = nodesResult.records[0];
    const pkgNodes = (rec.get('pkgNodes') || []).filter((n) => n.id);
    const devNodes = (rec.get('devNodes') || []).filter((n) => n.id);

    const allNodes = [...pkgNodes, ...devNodes].reduce((acc, n) => {
      if (!acc.find((x) => x.id === n.id)) acc.push(n);
      return acc;
    }, []);

    const depEdges = edgeResult.records.map((r) => ({
      source: r.get('source'),
      target: r.get('target'),
      type: r.get('type'),
    }));
    const maintEdges = maintEdgeResult.records
      .filter((r) => r.get('source'))
      .map((r) => ({
        source: r.get('source'),
        target: r.get('target'),
        type: r.get('type'),
      }));

    return { nodes: allNodes, links: [...depEdges, ...maintEdges] };
  });

  if (error) return res.status(503).json({ error, data: null });
  res.json({ data, query: 'dep-graph' });
});

export default router;
