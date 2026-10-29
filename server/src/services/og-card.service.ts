import type { EventRow } from '../db.ts';
import { renderOgPng } from '../og-image.ts';

export interface OgCard {
  png: Buffer;
  etag: string;
}

export interface OgCardService {
  cardFor(row: EventRow): OgCard;
}

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
