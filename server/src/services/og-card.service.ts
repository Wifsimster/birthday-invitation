// The Open Graph share card, and the cache in front of it.
//
// Rasterising costs ~50 ms, and a link pasted into a group chat is fetched by
// every scraper at once, so keep the rendered bytes around. The key carries
// updated_at, so an admin's edit invalidates the entry by itself.

import type { EventRow } from '../db.ts';
import { renderOgPng } from '../og-image.ts';

export interface OgCard {
  png: Buffer;
  etag: string;
}

export interface OgCardService {
  cardFor(row: EventRow): OgCard;
}

/** How many rendered cards to keep. Bounded so many events can't grow it freely. */
const DEFAULT_CACHE_SIZE = 32;

export function createOgCardService(
  render: (row: EventRow) => Buffer = renderOgPng,
  maxEntries = DEFAULT_CACHE_SIZE
): OgCardService {
  const cache = new Map<string, Buffer>();

  return {
    cardFor(row) {
      const key = `${row.id}:${row.updated_at}:${row.theme}`;
      let png = cache.get(key);
      if (!png) {
        png = render(row);
        // Drop the oldest entry once full (Map keeps insertion order).
        if (cache.size >= maxEntries) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, png);
      }
      return { png, etag: `W/"og-${key}"` };
    }
  };
}
