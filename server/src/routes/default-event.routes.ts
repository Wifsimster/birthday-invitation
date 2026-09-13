// The legacy un-slugged routes, which act on the deployment's default event.
//
// They predate multi-event support and are what an env-configured deployment's
// invitation link still calls. Every one of them resolves the default event and
// then delegates to the same services the event-scoped routes use, so the two
// surfaces cannot drift apart.

import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { CSV_BOM, toCsv } from '../http/csv.ts';
import { parseBody, rsvpSchema } from '../http/validation.ts';
import { buildIcs } from '../domain/event.ts';
import { notFound } from '../domain/errors.ts';
import { sendCard } from '../http/og-response.ts';
import type { RouteDeps } from './deps.ts';

export function createDefaultEventRoutes(
  { guards, limiters, events, rsvps, ogCards }: RouteDeps
): Router {
  const router = Router();

  // Resolved lazily per request so it always reflects the current default row.
  const defaultEventId = (): number => events.defaultEvent().id;

  router.get('/api/rsvps', ...guards.admin, asyncHandler((_req, res) => {
    res.json({ rsvps: rsvps.list(defaultEventId()) });
  }));

  router.get('/api/rsvps/count', ...guards.admin, asyncHandler((_req, res) => {
    res.json(rsvps.counts(defaultEventId()));
  }));

  router.get('/api/rsvps/export.csv', ...guards.admin, asyncHandler((_req, res) => {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="rsvps.csv"');
    res.send(CSV_BOM + toCsv(rsvps.list(defaultEventId())));
  }));

  // Calendar invite (guest) generated from the event configuration.
  router.get('/api/event.ics', asyncHandler((_req, res) => {
    const ics = buildIcs(events.defaultEventConfig());
    if (!ics) throw notFound("Aucune date d'événement configurée");
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="invitation.ics"');
    res.send(ics);
  }));

  // Look up an existing RSVP so a guest can pre-fill / edit their response.
  // Rate-limited to blunt phone-number enumeration, and returns only the fields
  // the form needs — never the stored ip_address or internal timestamps.
  router.get('/api/rsvp/lookup/:phone', limiters.lookup, asyncHandler((req, res) => {
    res.json(rsvps.lookup(defaultEventId(), String(req.params.phone ?? '')));
  }));

  // Submit (or update) an RSVP. Phone is the guest identity: one per phone.
  router.post('/api/rsvp', limiters.rsvp, asyncHandler((req, res) => {
    const body = parseBody(rsvpSchema({ requireAttending: true, minGuests: 1 }), req.body);
    const result = rsvps.submit(defaultEventId(), events.defaultEventConfig(), body, req.ip ?? null);
    if (!result.created) {
      return res.json({ message: 'Réponse mise à jour avec succès !', id: result.id });
    }
    res.status(201).json({ message: 'Réponse soumise avec succès !', id: result.id });
  }));

  // Create an RSVP manually (admin) — e.g. replies received by phone/in person.
  // Not rate-limited like the public endpoint; one row per phone still applies.
  router.post('/api/rsvps', ...guards.admin, asyncHandler((req, res) => {
    const body = parseBody(rsvpSchema({ requireAttending: true, minGuests: 0 }), req.body);
    const id = rsvps.add(defaultEventId(), body);
    res.status(201).json({ message: 'RSVP ajouté avec succès !', id });
  }));

  // Update an RSVP of the default event (admin). Scoped like every other legacy
  // route: an id belonging to another event is a 404 here, not a silent
  // cross-event write.
  router.put('/api/rsvp/:id', ...guards.admin, asyncHandler((req, res) => {
    const body = parseBody(rsvpSchema({ requireAttending: false, minGuests: 0 }), req.body);
    const changes = rsvps.edit(defaultEventId(), req.params.id, body);
    res.json({ message: 'RSVP mis à jour avec succès !', changes });
  }));

  router.delete('/api/rsvp/:id', ...guards.admin, asyncHandler((req, res) => {
    const changes = rsvps.remove(defaultEventId(), req.params.id);
    res.json({ message: 'RSVP supprimé avec succès !', changes });
  }));

  // The shared guest list of the default event.
  router.get('/api/participants/:phone', limiters.lookup, asyncHandler((req, res) => {
    res.json(rsvps.sharedGuests(defaultEventId(), String(req.params.phone ?? '')));
  }));

  // The share card of the default event.
  router.get('/api/og.png', asyncHandler((req, res) => {
    sendCard(res, req.headers['if-none-match'], ogCards.cardFor(events.defaultEvent()));
  }));

  return router;
}

