import { MarketItemListResponse, MarketOrder, RankedSyndicateItem, SyndicateItem } from './types.js';
import { logInfo, logWarn } from './logger.js';

const MARKET_API = 'https://api.warframe.market/v2';
const ORDER_REQUEST_BATCH_SIZE = 4;

function getLowestFourAverage(orders: MarketOrder[]): number | null {
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

  if (pricesBySeller.size < 4) return null;

  const lowestFourSellerPrices = [...pricesBySeller.values()]
    .sort((a, b) => a - b)
    .slice(0, 4);

  return lowestFourSellerPrices.reduce((sum, amount) => sum + amount, 0) / lowestFourSellerPrices.length;
}

async function fetchMarketItemNameMap(): Promise<Map<string, string>> {
  const response = await fetch(`${MARKET_API}/items`, {
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

async function fetchMarketItem(urlName: string): Promise<MarketOrder[]> {
  const response = await fetch(`${MARKET_API}/orders/item/${encodeURIComponent(urlName)}`, {
    headers: {
      Accept: 'application/json',
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

  const marketNameMap = await fetchMarketItemNameMap();
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
  for (let offset = 0; offset < marketItems.length; offset += ORDER_REQUEST_BATCH_SIZE) {
    const batch = marketItems.slice(offset, offset + ORDER_REQUEST_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async ({ item, urlName }) => {
      try {
        const orders = await fetchMarketItem(urlName);
        const lowestFourAverage = getLowestFourAverage(orders);
        if (lowestFourAverage === null) {
          offersWithInsufficientSellers += 1;
          return null;
        }

        return {
          itemName: item.itemName,
          factionSyndicate: item.faction,
          standingPerPlatinum: item.standing / lowestFourAverage,
          standing: item.standing,
          priceAverage: lowestFourAverage
        };
      } catch (error) {
        failedOrderRequests += 1;
        logWarn(`Unable to retrieve market orders for ${item.itemName} (${urlName}): ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    }));
    results.push(...batchResults.filter((item): item is RankedSyndicateItem => item !== null));
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
  logInfo(`Warframe.market ranking: ${results.length} offers with at least four distinct online-in-game sellers from ${marketItems.length} matched offers; ${offersWithInsufficientSellers} offers excluded for insufficient sellers; ${failedOrderRequests} order requests failed.`);
  return rankings;
}
