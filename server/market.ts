import { MarketItem, MarketItemListResponse, MarketOrder, RankedSyndicateItem, SyndicateItem } from './types.js';

const MARKET_API = 'https://api.warframe.market/v1/items';

function getLowestFourAverage(orders: MarketOrder[]): number {
  const visibleSellOrders = orders
    .filter((order) => order.visible && order.order_type === 'sell')
    .map((order) => order.platinum)
    .sort((a, b) => a - b)
    .slice(0, 4);

  if (visibleSellOrders.length === 0) return 0;
  return visibleSellOrders.reduce((sum, amount) => sum + amount, 0) / visibleSellOrders.length;
}

async function fetchMarketItemNameMap(): Promise<Map<string, string>> {
  const response = await fetch(MARKET_API, {
    headers: { 'User-Agent': 'WM.SPO/1.0 (cat = syndicate optimizer)' }
  });
  if (!response.ok) throw new Error(`Market catalog request failed: ${response.status}`);

  const payload = (await response.json()) as MarketItemListResponse;
  return new Map(
    (payload.payload?.items ?? [])
      .filter((item) => item.item_name)
      .map((item) => [item.item_name.toLowerCase(), item.url_name])
  );
}

async function fetchMarketItem(urlName: string): Promise<MarketOrder[]> {
  const response = await fetch(`${MARKET_API}/${encodeURIComponent(urlName)}/orders`);
  if (!response.ok) throw new Error(`Market request failed for ${urlName}`);
  const payload = (await response.json()) as { payload?: { orders?: MarketOrder[] } };
  return payload.payload?.orders ?? [];
}

export async function getRankedItems(items: SyndicateItem[]): Promise<RankedSyndicateItem[]> {
  if (items.length === 0) return [];

  const marketNameMap = await fetchMarketItemNameMap();
  const results: RankedSyndicateItem[] = [];

  for (const item of items) {
    const urlName = marketNameMap.get(item.itemName.toLowerCase());
    if (!urlName || item.standing <= 0) continue;

    const orders = await fetchMarketItem(urlName);
    const lowestFourAverage = getLowestFourAverage(orders);
    if (lowestFourAverage === 0) continue;

    results.push({
      itemName: item.itemName,
      factionSyndicate: item.faction,
      platinumPerStanding: Math.round(lowestFourAverage / item.standing),
      standing: item.standing,
      lowestFourAverage
    });
  }

  return Object.entries(
    results.reduce<Record<string, RankedSyndicateItem[]>>((groups, item) => {
      const key = item.factionSyndicate;
      groups[key] ??= [];
      groups[key].push(item);
      return groups;
    }, {})
  ).flatMap(([, factionItems]) =>
    factionItems
      .sort((a, b) => b.platinumPerStanding - a.platinumPerStanding)
      .slice(0, 10)
  );
}
