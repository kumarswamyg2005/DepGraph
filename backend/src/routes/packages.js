import express from 'express';
import { withSession, serializeRecord } from '../db.js';

const router = express.Router();

// GET /api/packages — list all packages, optional ?ecosystem= filter
router.get('/', async (req, res) => {
  const { ecosystem } = req.query;

  const query = ecosystem
    ? `MATCH (p:Package) WHERE p.ecosystem = $ecosystem RETURN p ORDER BY p.name LIMIT 200`
    : `MATCH (p:Package) RETURN p ORDER BY p.name LIMIT 200`;

  const { data, error } = await withSession(async (session) => {
    const result = await session.run(query, ecosystem ? { ecosystem } : {});
    return result.records.map((r) => serializeRecord(r));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [] });
});

// GET /api/packages/search?q= — typeahead search
router.get('/search', async (req, res) => {
  const { q = '' } = req.query;
  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (p:Package)
       WHERE toLower(p.name) CONTAINS toLower($q)
       RETURN p ORDER BY p.name LIMIT 20`,
      { q }
    );
    return result.records.map((r) => serializeRecord(r));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [] });
});

// GET /api/packages/graph?name= — full dep graph (nodes + links) for viz
router.get('/graph', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing ?name= parameter' });

  const { data, error } = await withSession(async (session) => {
    // 1) Root node
    const rootResult = await session.run(
      `MATCH (p:Package {name: $name}) RETURN p LIMIT 1`,
      { name }
    );
    if (rootResult.records.length === 0) return null;
    const root = serializeRecord(rootResult.records[0]).p;
    if (!root?.id) return null;

    const nodesMap = new Map();
    nodesMap.set(root.id, { ...root, type: 'Package', isRoot: true });

    // 2) All transitive dep nodes (no path comprehension — just node properties)
    const depsResult = await session.run(
      `MATCH (p:Package {name: $name})-[:DEPENDS_ON*1..5]->(dep:Package)
       RETURN DISTINCT dep.id AS id, dep.name AS name,
              dep.ecosystem AS ecosystem, dep.version AS version`,
      { name }
    );
    depsResult.records.forEach((r) => {
      const id = r.get('id');
      if (id) {
        nodesMap.set(id, {
          id,
          name: r.get('name'),
          ecosystem: r.get('ecosystem'),
          version: r.get('version'),
          type: 'Package',
        });
      }
    });

    // 3) All DEPENDS_ON edges where BOTH endpoints are in our node set
    const edgesResult = await session.run(
      `MATCH (a:Package)-[:DEPENDS_ON]->(b:Package)
       WHERE a.name = $name
       RETURN DISTINCT a.id AS src, b.id AS tgt
       UNION
       MATCH (p:Package {name: $name})-[:DEPENDS_ON*1..4]->(a:Package)-[:DEPENDS_ON]->(b:Package)
       RETURN DISTINCT a.id AS src, b.id AS tgt`,
      { name }
    );

    const links = [];
    edgesResult.records.forEach((r) => {
      const src = r.get('src');
      const tgt = r.get('tgt');
      if (src && tgt && nodesMap.has(src) && nodesMap.has(tgt)) {
        if (!links.some((l) => l.source === src && l.target === tgt)) {
          links.push({ source: src, target: tgt, type: 'DEPENDS_ON' });
        }
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links,
    };
  });

  if (error) return res.status(503).json({ error });
  if (!data) return res.status(404).json({ error: 'Package not found' });
  res.json({ data });
});

// GET /api/packages/:id — package detail with maintainers + direct deps
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (p:Package {id: $id})
       OPTIONAL MATCH (dev:Developer)-[:MAINTAINS]->(p)
       OPTIONAL MATCH (p)-[:DEPENDS_ON]->(dep:Package)
       OPTIONAL MATCH (repo:Repository)-[:PUBLISHES]->(p)
       RETURN p,
              collect(DISTINCT dev) AS maintainers,
              collect(DISTINCT dep) AS directDeps,
              collect(DISTINCT repo) AS repos`,
      { id }
    );
    if (result.records.length === 0) return null;
    return serializeRecord(result.records[0]);
  });

  if (error) return res.status(503).json({ error });
  if (!data || data.p === null) return res.status(404).json({ error: 'Package not found' });
  res.json({ data });
});

export default router;
