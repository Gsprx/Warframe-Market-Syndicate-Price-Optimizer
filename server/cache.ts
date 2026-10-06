import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Faction, SyndicateItem } from './types.js';
import { WIKI_CACHE_PATH } from './config.js';

const cachePath = fileURLToPath(WIKI_CACHE_PATH);
export const CACHE_VERSION = 1;

export async function readCache(): Promise<SyndicateItem[] | null> {
  try {
    const data = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(data) as { version: number; items: SyndicateItem[] };
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed.items;
  } catch {
    return null;
  }
}

export async function writeCache(items: SyndicateItem[]): Promise<void> {
  await mkdir(dirname(cachePath), { recursive: true });
  const payload = { version: CACHE_VERSION, items };
  await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8');
}

export function normalizeFactionName(value: string): Faction | null {
  const normalized = value.trim();
  const mapping: Record<string, Faction> = {
    'Steel Meridian': 'Steel Meridian',
    'Arbiters of Hexis': 'Arbiters of Hexis',
    'Cephalon Suda': 'Cephalon Suda',
    'The Perrin Sequence': 'The Perrin Sequence',
    'Red Veil': 'Red Veil',
    'New Loka': 'New Loka'
  };

  return mapping[normalized] ?? null;
}

export function matchesSyndicate(item: SyndicateItem, faction: Faction): boolean {
  return item.faction === faction;
}
