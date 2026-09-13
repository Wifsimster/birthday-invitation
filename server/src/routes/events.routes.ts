// Event management, and the RSVPs of one event.
//
// Every signed-in account may run as many invitations as it likes: creating one
// stamps it with the creator's id, and the service scopes each call to the
// invitations the account owns. An admin keeps the deployment-wide view — every
// event, the ownerless default one included.

import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { CSV_BOM, toCsv } from '../http/csv.ts';
import { actor } from '../http/guards.ts';
import { eventCreateSchema, eventUpdateSchema, parseBody, rsvpSchema } from '../http/validation.ts';
import type { RouteDeps } from './deps.ts';

export function createEventRoutes({ guards, events, rsvps }: RouteDeps): Router {
  const router = Router();

  // The account's own events with aggregated RSVP counts; every event for an
  // admin. Declared before the public GET /api/events/:slug so the param route
  // can't shadow this exact path.
  router.get('/api/events', ...guards.member, asyncHandler((_req, res) => {
    res.json({ events: events.listFor(actor(res)) });
  }));

  router.post('/api/events', ...guards.member, asyncHandler((req, res) => {
    const data = parseBody(eventCreateSchema, req.body);
    res.status(201).json(events.create(actor(res), data));
  }));

  router.put('/api/events/:id', ...guards.member, asyncHandler((req, res) => {
    const data = parseBody(eventUpdateSchema, req.body);
    res.json(events.update(actor(res), req.params.id, data));
  }));

  router.delete('/api/events/:id', ...guards.member, asyncHandler((req, res) => {
    const changes = events.remove(actor(res), req.params.id);
    res.json({ message: 'Événement supprimé', changes });
  }));

  // --- Per-event RSVPs (owner or admin) -------------------------------------
  //
  // Each handler resolves the event through the service first, which answers
  // 404 for an id this account cannot manage — so an unauthorised id never even
  // reaches the RSVP layer.

  router.get('/api/events/:id/rsvps', ...guards.member, asyncHandler((req, res) => {
    const event = events.requireManageable(actor(res), req.params.id);
    res.json({ rsvps: rsvps.list(event.id) });
  }));

  router.get('/api/events/:id/rsvps/count', ...guards.member, asyncHandler((req, res) => {
    const event = events.requireManageable(actor(res), req.params.id);
    res.json(rsvps.counts(event.id));
  }));

  router.get('/api/events/:id/rsvps/export.csv', ...guards.member, asyncHandler((req, res) => {
    const event = events.requireManageable(actor(res), req.params.id);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="rsvps-${event.slug}.csv"`);
    res.send(CSV_BOM + toCsv(rsvps.list(event.id)));
  }));

  router.post('/api/events/:id/rsvps', ...guards.member, asyncHandler((req, res) => {
    const event = events.requireManageable(actor(res), req.params.id);
    const body = parseBody(rsvpSchema({ requireAttending: true, minGuests: 0 }), req.body);
    res.status(201).json({ message: 'RSVP ajouté avec succès !', id: rsvps.add(event.id, body) });
  }));

  router.put('/api/events/:id/rsvp/:rsvpId', ...guards.member, asyncHandler((req, res) => {
    const event = events.requireManageable(actor(res), req.params.id);
    const body = parseBody(rsvpSchema({ requireAttending: false, minGuests: 0 }), req.body);
    const changes = rsvps.edit(event.id, req.params.rsvpId, body);
    res.json({ message: 'RSVP mis à jour avec succès !', changes });
  }));

  router.delete('/api/events/:id/rsvp/:rsvpId', ...guards.member, asyncHandler((req, res) => {
    const event = events.requireManageable(actor(res), req.params.id);
    const changes = rsvps.remove(event.id, req.params.rsvpId);
    res.json({ message: 'RSVP supprimé avec succès !', changes });
  }));

  return router;
}
