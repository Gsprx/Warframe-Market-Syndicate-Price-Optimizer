import { useEffect, useMemo, useState } from 'react';

type Faction =
  | 'Steel Meridian'
  | 'Arbiters of Hexis'
  | 'Cephalon Suda'
  | 'The Perrin Sequence'
  | 'Red Veil'
  | 'New Loka';

type RankedItem = {
  itemName: string;
  factionSyndicate: Faction;
  standingPerPlatinum: number;
  standing: number;
  priceAverage: number;
};

type ApiError = string;

const FACTIONS: Faction[] = [
  'Steel Meridian',
  'Arbiters of Hexis',
  'Cephalon Suda',
  'The Perrin Sequence',
  'Red Veil',
  'New Loka'
];

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: 'Request failed' }))) as { error?: string };
    throw new Error(body.error ?? 'Request failed');
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [items, setItems] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError>('');
  const [cached, setCached] = useState(false);

  const selectedFactionCount = factions.length;

  const summary = useMemo(() => {
    if (!items.length) return { best: null, average: 0, total: 0 };
    const best = items.reduce((winner, item) => (item.standingPerPlatinum < winner.standingPerPlatinum ? item : winner));
    const average = items.reduce((sum, item) => sum + item.standingPerPlatinum, 0) / items.length;
    return { best, average, total: items.length };
  }, [items]);

  const loadRankings = async () => {
    if (factions.length === 0) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ factions: factions.join(',') });
      const rankings = await api<{ items: RankedItem[]; factions: Faction[] }>(
        `/api/ranked-items?${query.toString()}`
      );
      setItems(rankings.items);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to load rankings.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaction = (faction: Faction) => {
    setFactions((current) =>
      current.includes(faction)
        ? current.filter((value) => value !== faction)
        : [...current, faction]
    );
  };

  useEffect(() => {
    if (selectedFactionCount > 0) {
      void loadRankings();
    } else {
      setItems([]);
    }
  }, [factions]);

  const refreshCache = async () => {
    setRefreshing(true);
    setError('');
    try {
      const response = await api<{ items: RankedItem[]; refreshed: boolean }>(
        '/api/cache/refresh',
        { method: 'POST' }
      );
      setCached(response.refreshed);
      await loadRankings();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to refresh the wiki cache.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Warframe Market Syndicate Price Optimizer</p>
          <h1>WM.SPO</h1>
        </div>
        <button className="primary-button" onClick={refreshCache} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh wiki cache'}
        </button>
      </header>

      <main className="content">
        <section className="toolbar panel">
          <div>
            <p className="label">Factions</p>
            <div className="faction-pills">
              {FACTIONS.map((faction) => (
                <button
                  key={faction}
                  className={factions.includes(faction) ? 'pill active' : 'pill'}
                  onClick={() => toggleFaction(faction)}
                >
                  {faction}
                </button>
              ))}
            </div>
          </div>
          <div className="status-block">
            <span className="status-dot" />
            <span>{cached ? 'Cache current' : 'Cache available'}</span>
          </div>
        </section>

        <section className="stats-grid">
          <article className="panel stat-card">
            <span className="stat-name">Selected factions</span>
            <strong>{selectedFactionCount}</strong>
          </article>
          <article className="panel stat-card">
            <span className="stat-name">Top results</span>
            <strong>{items.length}</strong>
          </article>
          <article className="panel stat-card">
            <span className="stat-name">Average Standing / Platinum</span>
            <strong>{summary.average.toFixed(2)}</strong>
          </article>
          <article className="panel stat-card">
            <span className="stat-name">Best Standing per Platinum</span>
            <strong>{summary.best ? `${summary.best.itemName} · ${summary.best.standingPerPlatinum.toFixed(2)}` : '—'}</strong>
          </article>
        </section>

        {error && <div className="panel error-banner">{error}</div>}

        <section className="panel table-panel">
          <div className="table-header">
            <h2>Top syndicate offers</h2>
            <span>{loading ? 'Updating...' : `${items.length} entries`}</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Faction</th>
                  <th>Standing Cost</th>
                  <th>Platinum Price Average</th>
                  <th>Standing per Platinum</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      {loading
                        ? 'Loading syndicate offers…'
                        : selectedFactionCount === 0
                          ? 'Select at least one faction to view results.'
                          : 'No priced offers found. Check the error above or app-debug.txt, then refresh the wiki cache if needed.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={`${item.factionSyndicate}-${item.itemName}`}>
                      <td>{index + 1}</td>
                      <td>{item.itemName}</td>
                      <td>{item.factionSyndicate}</td>
                      <td>{item.standing}</td>
                      <td>{item.priceAverage.toFixed(2)}</td>
                      <td>{item.standingPerPlatinum.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
