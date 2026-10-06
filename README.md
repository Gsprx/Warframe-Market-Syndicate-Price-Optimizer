# Warframe Market Syndicate Price Optimizer

WM.SPO is a dark-themed React and Node.js application for finding the best syndicate offerings by comparing the average lowest four sell prices against each item's standing cost.

## Features

- Queries all six syndicate factions used by Warframe.
- Filters results by selected factions.
- Uses a local syndicate cache stored in `data/syndicate-items.json`.
- Refreshes the wiki-derived cache only when the user clicks **Refresh wiki cache**.
- Displays the top 10 items per selected faction by PlatinumPerStanding.
- Uses the Warframe.market public catalog and order endpoints.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the application:
   ```bash
   npm run dev
   ```
3. Open the Vite URL printed by the terminal, usually `http://localhost:5173`.

The frontend is served by Vite and proxies `/api` requests to the Express server on port `3001`.

## Build

```bash
npm run build
```

The compiled server is emitted to `dist-server`, and the frontend is emitted to `dist`.

## Notes

- The application is designed to use the official Warframe Wiki MediaWiki API and the official Warframe.market API.
- The included syndicate seed is a local fallback. Its contents should be refreshed after major game updates.
- No account credentials or personal API keys are required.
