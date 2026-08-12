import express from 'express';
import { withSession, serializeRecord } from '../db.js';

const router = express.Router();

// GET /api/developers — list all developers
router.get('/', async (req, res) => {
  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (d:Developer)
       OPTIONAL MATCH (d)-[:MAINTAINS]->(p:Package)
       RETURN d, count(p) AS packageCount ORDER BY packageCount DESC LIMIT 200`
    );
    return result.records.map((r) => serializeRecord(r));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [] });
});

// GET /api/developers/search?q= — typeahead search
router.get('/search', async (req, res) => {
  const { q = '' } = req.query;
  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (d:Developer)
       WHERE toLower(d.username) CONTAINS toLower($q)
          OR toLower(d.name) CONTAINS toLower($q)
       RETURN d ORDER BY d.username LIMIT 20`,
      { q }
    );
    return result.records.map((r) => serializeRecord(r));
  });

  if (error) return res.status(503).json({ error, data: [] });
  res.json({ data: data ?? [] });
});

// GET /api/developers/:id — developer detail with packages + repos
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (d:Developer {id: $id})
       OPTIONAL MATCH (d)-[:MAINTAINS]->(p:Package)
       OPTIONAL MATCH (d)-[c:CONTRIBUTES_TO]->(r:Repository)
       OPTIONAL MATCH (d)-[:MEMBER_OF]->(o:Organization)
       RETURN d,
              collect(DISTINCT p) AS maintainedPackages,
              collect(DISTINCT {repo: r, commits: c.commits}) AS contributions,
              collect(DISTINCT o) AS orgs`,
      { id }
    );
    if (result.records.length === 0) return null;
    return serializeRecord(result.records[0]);
  });

  if (error) return res.status(503).json({ error });
  if (!data || data.d === null) return res.status(404).json({ error: 'Developer not found' });
  res.json({ data });
});

export default router;
