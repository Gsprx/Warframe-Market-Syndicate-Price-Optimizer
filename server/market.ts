import { MarketItemListResponse, MarketOrder, RankedSyndicateItem, SyndicateItem } from './types.js';
import { logInfo, logWarn } from './logger.js';

const MARKET_API = 'https://api.warframe.market/v2';
const MARKET_REQUEST_INTERVAL_MS = 350;
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_FALLBACK_MS = 1000;

let marketRequestQueue: Promise<void> = Promise.resolve();
let nextMarketRequestAt = 0;
let marketItemNameMapPromise: Promise<Map<string, string>> | undefined;

function fetchMarket(url: string, init?: RequestInit): Promise<Response> {
  const request = marketRequestQueue.then(async () => {
    for (let attempt = 0; ; attempt += 1) {
      const waitMs = Math.max(0, nextMarketRequestAt - Date.now());
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      nextMarketRequestAt = Date.now() + MARKET_REQUEST_INTERVAL_MS;

      const response = await fetch(url, init);
      if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return response;

      const retryAfter = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
      const retryAfterDate = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
      const retryDelayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
        ? retryAfterSeconds * 1000
        : Number.isFinite(retryAfterDate)
          ? Math.max(0, retryAfterDate - Date.now())
          : RATE_LIMIT_FALLBACK_MS * (2 ** attempt);

      nextMarketRequestAt = Math.max(nextMarketRequestAt, Date.now() + retryDelayMs);
      logWarn(`Warframe.market rate limit reached; retrying ${url} after ${Math.ceil(retryDelayMs)}ms.`);
    }
  });
  marketRequestQueue = request.then(() => undefined, () => undefined);
  return request;
}

function getLowestThreeAverage(orders: MarketOrder[]): number | null {
  const pricesBySeller = new Map<string, number>();
  for (const order of orders) {
    if (
      !order.visible
      || order.type !== 'sell'
      || order.user?.status !== 'ingame'
      || !order.user.id
      || !Number.isFinite(order.platinum)
    ) continue;

    const sellerPrice = pricesBySeller.get(order.user.id);
    if (sellerPrice === undefined || order.platinum < sellerPrice) {
      pricesBySeller.set(order.user.id, order.platinum);
    }
  }

  if (pricesBySeller.size < 3) return null;

  const lowestThreeSellerPrices = [...pricesBySeller.values()]
    .sort((a, b) => a - b)
    .slice(0, 3);

  return lowestThreeSellerPrices.reduce((sum, amount) => sum + amount, 0) / lowestThreeSellerPrices.length;
}

async function fetchMarketItemNameMap(): Promise<Map<string, string>> {
  const response = await fetchMarket(`${MARKET_API}/items`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WM.SPO/1.0 (syndicate price optimizer)'
    }
  });
  if (!response.ok) throw new Error(`Warframe.market catalog request failed: HTTP ${response.status}`);

  const payload = (await response.json()) as MarketItemListResponse;
  const nameMap = new Map<string, string>();
  for (const item of payload.data ?? []) {
    const itemName = item.i18n?.en?.name;
    if (itemName) nameMap.set(itemName.toLowerCase(), item.slug);
  }
  logInfo(`Warframe.market catalog returned ${nameMap.size} items.`);
  return nameMap;
}

function getMarketItemNameMap(): Promise<Map<string, string>> {
  if (!marketItemNameMapPromise) {
    const request = fetchMarketItemNameMap();
    marketItemNameMapPromise = request;
    void request.catch(() => {
      if (marketItemNameMapPromise === request) marketItemNameMapPromise = undefined;
    });
  }
  return marketItemNameMapPromise;
}

async function fetchMarketItem(urlName: string): Promise<MarketOrder[]> {
  const response = await fetchMarket(`${MARKET_API}/orders/item/${encodeURIComponent(urlName)}`, {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      'User-Agent': 'WM.SPO/1.0 (syndicate price optimizer)'
    }
  });
  if (!response.ok) throw new Error(`Warframe.market orders request failed for ${urlName}: HTTP ${response.status}`);
  const payload = (await response.json()) as { data?: MarketOrder[] };
  return payload.data ?? [];
}

export async function getRankedItems(items: SyndicateItem[]): Promise<RankedSyndicateItem[]> {
  if (items.length === 0) {
    logWarn('Ranking skipped: there are no cached syndicate items to compare.');
    return [];
  }

  const itemsNeedingLookup = items.filter((item) => item.standing > 0 && !item.marketItemUrl);
  const marketNameMap = itemsNeedingLookup.length > 0
    ? await getMarketItemNameMap()
    : new Map<string, string>();
  const marketItems = items.flatMap((item) => {
    const normalizedName = item.itemName.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();
    const urlName = item.marketItemUrl
      || marketNameMap.get(item.itemName.toLowerCase())
      || marketNameMap.get(normalizedName);
    if (!urlName || item.standing <= 0) return [];
    return [{ item, urlName }];
  });
  const unmatchedCount = items.length - marketItems.length;
  if (unmatchedCount > 0) {
    logWarn(`${unmatchedCount} cached offerings had no Warframe.market match or a non-positive standing cost.`);
  }

  const results: RankedSyndicateItem[] = [];
  let failedOrderRequests = 0;
  let offersWithInsufficientSellers = 0;
  for (const { item, urlName } of marketItems) {
    try {
      const orders = await fetchMarketItem(urlName);
      const lowestThreeAverage = getLowestThreeAverage(orders);
      if (lowestThreeAverage === null) {
        offersWithInsufficientSellers += 1;
        continue;
      }

      results.push({
        itemName: item.itemName,
        factionSyndicate: item.faction,
        standingPerPlatinum: item.standing / lowestThreeAverage,
        standing: item.standing,
        priceAverage: lowestThreeAverage
      });
    } catch (error) {
      failedOrderRequests += 1;
      logWarn(`Unable to retrieve market orders for ${item.itemName} (${urlName}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const rankings = Object.entries(
    results.reduce<Record<string, RankedSyndicateItem[]>>((groups, item) => {
      const key = item.factionSyndicate;
      groups[key] ??= [];
      groups[key].push(item);
      return groups;
    }, {})
  ).flatMap(([, factionItems]) =>
    factionItems
      .sort((a, b) => a.standingPerPlatinum - b.standingPerPlatinum)
      .slice(0, 10)
  ).sort((a, b) =>
    a.standingPerPlatinum - b.standingPerPlatinum
    || a.factionSyndicate.localeCompare(b.factionSyndicate)
    || a.itemName.localeCompare(b.itemName)
  );
  logInfo(`Warframe.market ranking: ${results.length} offers with at least three distinct online-in-game sellers from ${marketItems.length} matched offers; ${offersWithInsufficientSellers} offers excluded for insufficient sellers; ${failedOrderRequests} order requests failed.`);
  return rankings;
}
