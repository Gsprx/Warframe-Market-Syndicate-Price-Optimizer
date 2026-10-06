export type Faction =
  | 'Steel Meridian'
  | 'Arbiters of Hexis'
  | 'Cephalon Suda'
  | 'The Perrin Sequence'
  | 'Red Veil'
  | 'New Loka';

export interface SyndicateItem {
  itemName: string;
  faction: Faction;
  standing: number;
  marketItemUrl: string;
  wikiUrl: string;
}

export interface MarketOrder {
  id: string;
  user: { id: string; ingame_name: string };
  platform: string;
  region: string;
  order_type: 'sell' | 'buy';
  quantity: number;
  platinum: number;
  visible: boolean;
}

export interface MarketItem {
  item_name: string;
  url_name: string;
  orders?: MarketOrder[];
}

export interface MarketItemListResponse {
  payload?: { items?: MarketItem[] };
}

export interface RankedSyndicateItem {
  itemName: string;
  factionSyndicate: Faction;
  platinumPerStanding: number;
  standing: number;
  lowestFourAverage: number;
}
