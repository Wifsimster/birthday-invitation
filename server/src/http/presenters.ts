import { eventConfigFromRow, isRsvpClosed } from '../domain/event.ts';
import { DEFAULT_ROLE, isRole, type SessionUser } from '../auth.ts';
import type { EventRow } from '../db.ts';
import type { UserRow } from '../repositories/types.ts';

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
