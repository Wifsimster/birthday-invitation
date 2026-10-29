import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { buildIcs, eventConfigFromRow } from '../domain/event.ts';
import { notFound } from '../domain/errors.ts';
import { sendCard } from '../http/og-response.ts';
import { publicEvent } from '../http/presenters.ts';
import { parseBody, rsvpSchema } from '../http/validation.ts';
import type { RouteDeps } from './deps.ts';

export function createPublicEventRoutes(
  { limiters, events, rsvps, ogCards }: RouteDeps
): Router {
  const router = Router();

  router.get('/api/events/:slug', asyncHandler((req, res) => {
    res.json(publicEvent(events.requireBySlug(String(req.params.slug))));
  }));

  router.post('/api/events/:slug/rsvp', limiters.rsvp, asyncHandler((req, res) => {
    const event = events.requireBySlug(String(req.params.slug));
    const body = parseBody(rsvpSchema({ requireAttending: true, minGuests: 1 }), req.body);
    const result = rsvps.submit(event.id, eventConfigFromRow(event), body, req.ip ?? null);
    if (!result.created) {
      return res.json({ message: 'Réponse mise à jour avec succès !', id: result.id });
    }
    res.status(201).json({ message: 'Réponse soumise avec succès !', id: result.id });
  }));

  router.get('/api/events/:slug/rsvp/lookup/:phone', limiters.lookup, asyncHandler((req, res) => {
    const event = events.requireBySlug(String(req.params.slug));
    res.json(rsvps.lookup(event.id, String(req.params.phone ?? '')));
  }));

  router.get('/api/events/:slug/participants/:phone', limiters.lookup, asyncHandler((req, res) => {
    const event = events.requireBySlug(String(req.params.slug));
    res.json(rsvps.sharedGuests(event.id, String(req.params.phone ?? '')));
  }));

  router.get('/api/events/:slug/og.png', asyncHandler((req, res) => {
    const event = events.requireBySlug(String(req.params.slug));
    sendCard(res, req.headers['if-none-match'], ogCards.cardFor(event));
  }));

  router.get('/api/events/:slug/event.ics', asyncHandler((req, res) => {
    const event = events.requireBySlug(String(req.params.slug));
    const ics = buildIcs(eventConfigFromRow(event));
    if (!ics) throw notFound("Aucune date d'événement configurée");
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="invitation.ics"');
    res.send(ics);
  }));

  return router;
}
