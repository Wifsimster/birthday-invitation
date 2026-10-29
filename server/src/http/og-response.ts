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
