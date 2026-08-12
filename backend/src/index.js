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
app.use(cors());
app.use(express.json());

// Auto-initialize driver middleware for serverless/standalone environments
let driverInitPromise = null;
app.use(async (req, res, next) => {
  if (getStatus() !== 'connected') {
    if (!driverInitPromise) {
      driverInitPromise = initDriver();
    }
    await driverInitPromise;
  }
  next();
});

// ── Root Info ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'DepGraph OSS Supply-Chain Trust API Server',
    status: getStatus(),
    endpoints: {
      health: '/api/health',
      packages: '/api/packages',
      developers: '/api/developers',
      busFactor: '/api/queries/bus-factor',
      transitiveDeps: '/api/queries/transitive-deps?name=wexa-core',
      blastRadius: '/api/queries/blast-radius?username=ghost-maintainer',
    },
  });
});

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
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start listening if running standalone server (Render / Local)
if (!process.env.VERCEL) {
  initDriver().then(() => {
    app.listen(PORT, () => {
      console.log(`[server] Listening on http://localhost:${PORT}`);
      console.log(`[server] DB status: ${getStatus()}`);
    });
  });
}

export default app;
