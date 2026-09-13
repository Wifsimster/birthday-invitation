// Sending a rendered share card.
//
// Scrapers refetch these links constantly, so the response carries an ETag and
// honours the conditional GET that follows — the rasteriser is the expensive
// part and a 304 skips the bytes entirely.

import type { Response } from 'express';
import type { OgCard } from '../services/og-card.service.ts';

export function sendCard(
  res: Response,
  ifNoneMatch: string | string[] | undefined,
  card: OgCard
): void {
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('ETag', card.etag);
  if (ifNoneMatch === card.etag) {
    res.status(304).end();
    return;
  }
  res.send(card.png);
}
