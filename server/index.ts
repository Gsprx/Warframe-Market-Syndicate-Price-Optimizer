import cors from 'cors';
import express from 'express';
import { readCache, writeCache } from './cache.js';
import { API_PORT, SYNDICATE_FACTIONS } from './config.js';
import { fetchSyndicateItems } from './wiki.js';
import { getRankedItems } from './market.js';
import { logError, logInfo, logWarn } from './logger.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const message = `${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`;
    if (res.statusCode >= 500) {
      logWarn(message);
    } else {
      logInfo(message);
    }
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'WM.SPO' });
});

app.get('/api/factions', (_req, res) => {
  res.json({ factions: SYNDICATE_FACTIONS });
});

app.get('/api/syndicate-items', async (req, res) => {
  const refresh = req.query.refresh === 'true';

  try {
    const items = await fetchSyndicateItems(refresh);
    res.json({ items, cached: Boolean(await readCache()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load syndicate items';
    logError('GET /api/syndicate-items failed', error);
    res.status(502).json({ error: message });
  }
});

app.get('/api/ranked-items', async (req, res) => {
  const factions = typeof req.query.factions === 'string' ? req.query.factions.split(',') : [];
  const filter = factions.filter((faction): faction is typeof SYNDICATE_FACTIONS[number] =>
    SYNDICATE_FACTIONS.includes(faction as typeof SYNDICATE_FACTIONS[number])
  );

  try {
    const items = await fetchSyndicateItems();
    const filtered = items.filter((item) => filter.includes(item.faction));
    const rankings = await getRankedItems(filtered);
    logInfo(`Ranking completed for factions [${filter.join(', ')}]: ${filtered.length} cached items, ${rankings.length} results.`);
    res.json({ items: rankings, factions: filter });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rank syndicate items';
    logError('GET /api/ranked-items failed', error);
    res.status(502).json({ error: message });
  }
});

app.post('/api/cache/refresh', async (_req, res) => {
  try {
    const items = await fetchSyndicateItems(true);
    await writeCache(items);
    res.json({ items, refreshed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh syndicate cache';
    logError('POST /api/cache/refresh failed', error);
    res.status(502).json({ error: message });
  }
});

app.listen(API_PORT, () => {
  logInfo(`WM.SPO API server listening on http://localhost:${API_PORT}`);
});
