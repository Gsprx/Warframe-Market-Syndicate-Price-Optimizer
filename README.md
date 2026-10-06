# Warframe Market Syndicate Price Optimizer

WM.SPO is a dark-themed React and Node.js application for finding syndicate offerings with the best standing value, using Warframe.market sell prices from sellers who are online in-game.

## Features

- Queries all six syndicate factions used by Warframe.
- Filters results by selected factions.
- Uses a local syndicate cache stored in `data/syndicate-items.json`.
- Refreshes the wiki-derived cache only when the user clicks **Refresh wiki cache**.
- Displays up to 10 items per selected faction, then sorts all displayed results together by Standing per Platinum in ascending order (the lowest standing cost per platinum comes first).
- Uses the Warframe.market public v2 catalog and order endpoints.
- Calculates prices using only visible sell orders from sellers whose Warframe.market status is `ingame`.
- Excludes offerings with fewer than four distinct active online-in-game sellers. If a seller has multiple visible sell orders for an offering, only that seller's lowest price is counted.
- Calculates **Platinum Price Average** from the four lowest qualifying seller prices, then calculates **Standing per Platinum** as `standing cost ÷ platinum price average`.

The results table shows Item Name, Faction, Standing Cost, Platinum Price Average, and Standing per Platinum, in that order. A lower Standing per Platinum value indicates a better standing-to-platinum exchange.

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
On Windows, you can instead double-click **Start WM.SPO.bat** in the project folder. It starts the application, waits for it to respond, and opens the app in your browser. It installs dependencies if they are not already present. Keep the server window open while using WM.SPO; close it to stop the app.

## Debugging

The server writes timestamped API requests, errors, and cache-read problems to `app-debug.txt` in the project folder. The file is created automatically and appended to each time the server runs. The same messages are also shown in the server terminal window.

Faction filters start deselected. Select one or more factions to fetch and view their rankings.

## Build

```bash
npm run build
```

The compiled server is emitted to `dist-server`, and the frontend is emitted to `dist`.

## Notes

- The application is designed to use the official Warframe Wiki MediaWiki API and the official Warframe.market API.
- The included syndicate seed is a local fallback. Its contents should be refreshed after major game updates.
- No account credentials or personal API keys are required.
