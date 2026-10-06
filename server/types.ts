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
  type: 'sell' | 'buy';
  platinum: number;
  visible: boolean;
  user: {
    id: string;
    status: 'ingame' | 'online' | 'offline' | string;
  };
}

export interface MarketItem {
  slug: string;
  i18n?: { en?: { name?: string } };
}

export interface MarketItemListResponse {
  data?: MarketItem[];
}

export interface RankedSyndicateItem {
  itemName: string;
  factionSyndicate: Faction;
  standingPerPlatinum: number;
  standing: number;
  priceAverage: number;
}
