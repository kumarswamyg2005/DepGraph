import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { initDriver, getStatus } from './db.js';
import packagesRouter from './routes/packages.js';
import developersRouter from './routes/developers.js';
import queriesRouter from './routes/queries.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const status = getStatus();
  res.json({
    status,
    connected: status === 'connected',
    timestamp: new Date().toISOString(),
  });
});

// ── Routers ───────────────────────────────────────────────────────────────────
app.use('/api/packages', packagesRouter);
app.use('/api/developers', developersRouter);
app.use('/api/queries', queriesRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  await initDriver();
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
    console.log(`[server] DB status: ${getStatus()}`);
  });
}

boot();
