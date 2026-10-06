import { Faction } from './types.js';

export const API_PORT = Number(process.env.PORT ?? 3001);
export const SYNDICATE_FACTIONS: readonly Faction[] = [
  'Steel Meridian',
  'Arbiters of Hexis',
  'Cephalon Suda',
  'The Perrin Sequence',
  'Red Veil',
  'New Loka'
] as const;

export const WIKI_CACHE_PATH = new URL('../data/syndicate-items.json', import.meta.url);
export const WIKI_SOURCE_URL = 'https://wiki.warframe.com/api.php';
export const WIKI_QUERY = 'https://wiki.warframe.com/w/api.php?action=query&format=json&prop=links&titles=Steel%20Meridian%7CArbiters%20of%20Hexis%7C&redirects=1&pllimit=max';
