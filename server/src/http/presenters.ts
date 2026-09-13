// Wire formats.
//
// What the API hands back is a decision of its own: a stored row carries
// internal ids, timestamps and a guest's ip address, and only some of that is
// anyone else's business. Keeping the shaping here means a new column is not
// published by accident just because a route selected `*`.

import { eventConfigFromRow, isRsvpClosed } from '../domain/event.ts';
import { DEFAULT_ROLE, isRole, type SessionUser } from '../auth.ts';
import type { EventRow } from '../db.ts';
import type { UserRow } from '../repositories/types.ts';

/**
 * Safe event fields for the public invitation route (no internal ids or
 * timestamps), plus a computed `rsvp_closed` flag.
 */
export function publicEvent(row: EventRow): Record<string, unknown> {
  return {
    slug: row.slug,
    person: row.person,
    age: row.age,
    date: row.date,
    time: row.time,
    town: row.town,
    location: row.location,
    dress_code: row.dress_code,
    theme: row.theme,
    rsvp_deadline: row.rsvp_deadline,
    rsvp_closed: isRsvpClosed(eventConfigFromRow(row))
  };
}

/**
 * A user row for the admin UI. An unknown/NULL role reads as the default,
 * matching how the session guard interprets it.
 */
export function publicUser(row: UserRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email,
    image: row.image,
    emailVerified: Boolean(row.emailVerified),
    role: isRole(row.role) ? row.role : DEFAULT_ROLE,
    created_at: row.createdAt
  };
}

/** The signed-in account, as GET /api/me reports it. */
export function currentAccount(user: SessionUser): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    image: user.image ?? null,
    emailVerified: Boolean(user.emailVerified),
    role: user.role
  };
}
