// Storage ports.
//
// Each aggregate gets its own narrow interface listing exactly the operations
// its callers need — not a general "run this SQL" handle. Services and routes
// depend on these; the SQLite implementations next to this file are the only
// code that knows the schema, the dialect or that better-sqlite3 exists at all.
// Swapping the store, or standing a fake up in a test, means implementing three
// small interfaces rather than intercepting strings of SQL.

import type { EventRow, RsvpRow } from '../db.ts';
import type { Attending } from '../domain/rsvp.ts';

// --- Events -----------------------------------------------------------------

/** Aggregated RSVP counters attached to an event row on the overview. */
export interface EventCounts {
  responses: number;
  confirmations: number;
  declined: number;
  total_guests: number;
}

/** The writable fields of an event. `slug` and `owner_id` are set on create. */
export interface EventFields {
  person: string;
  age: string;
  date: string;
  time: string;
  town: string;
  location: string;
  dress_code: string;
  theme: string;
  rsvp_deadline: string;
}

export interface NewEvent extends EventFields {
  slug: string;
  owner_id: string | null;
}

export interface EventRepository {
  findById(id: number): EventRow | undefined;
  findBySlug(slug: string): EventRow | undefined;
  /** The event backing the legacy single-event routes, created if missing. */
  findDefault(): EventRow;
  /** Every event, ordered for the sitemap (default first, then by id). */
  listAll(): EventRow[];
  /**
   * Events with their RSVP counters. `ownerId` narrows the list to one
   * account's invitations; omitting it lists the whole deployment (admin).
   */
  listWithCounts(ownerId?: string): (EventRow & EventCounts)[];
  /** True when the slug is used by an event other than `exceptId`. */
  slugTaken(slug: string, exceptId?: number): boolean;
  insert(data: NewEvent): EventRow;
  /** Replace every writable field (callers merge partial input first). */
  update(id: number, data: EventFields & { slug: string }): EventRow | undefined;
  updateTheme(id: number, theme: string): void;
  deleteById(id: number): number;
  /** Delete every invitation of one account; returns the row count. */
  deleteByOwner(ownerId: string): number;
}

// --- RSVPs ------------------------------------------------------------------

/** Counters for one event, as the dashboard and the guest list read them. */
export interface RsvpCounts {
  total_responses: number;
  confirmations: number;
  declined: number;
  total_guests: number;
}

/** The subset of a response the guest's own form reads back. */
export type RsvpSummary = Pick<
  RsvpRow,
  'id' | 'attending' | 'name' | 'email' | 'phone' | 'guests' | 'dietary_restrictions' | 'message' | 'share_response'
>;

/** One line of the shared guest list: a name and a party size, nothing else. */
export interface SharedParticipant {
  name: string;
  guests: number;
}

/** A response as the write paths store it (already normalised by the domain). */
export interface RsvpRecord {
  attending: Attending;
  name: string;
  email: string | null;
  phone: string;
  guests: number;
  dietary_restrictions: string | null;
  message: string | null;
  share_response: number;
  ip_address?: string | null;
}

export interface RsvpRepository {
  listByEvent(eventId: number): RsvpRow[];
  countsByEvent(eventId: number): RsvpCounts;
  /** The response a phone number holds on this event, if any. */
  findByPhone(eventId: number, phone: string): RsvpRow | undefined;
  /** The fields the invitation form pre-fills from, never the stored ip. */
  findSummaryByPhone(eventId: number, phone: string): RsvpSummary | undefined;
  /** One response of this event by row id, or undefined when it is another's. */
  findSummaryById(eventId: number, rsvpId: number): RsvpSummary | undefined;
  /** True when a *different* response on this event already holds the number. */
  phoneTaken(eventId: number, phone: string, exceptRsvpId: number): boolean;
  insert(eventId: number, record: RsvpRecord): number;
  /** Overwrite an existing response; returns the number of rows changed. */
  update(eventId: number, rsvpId: number, record: RsvpRecord): number;
  /** Overwrite by row id, for the guest path that resolved the row by phone. */
  updateById(rsvpId: number, record: RsvpRecord): number;
  deleteById(eventId: number, rsvpId: number): number;
  /** Confirmed guests who opted into being listed, ordered by name. */
  sharedParticipants(eventId: number): SharedParticipant[];
}

// --- Accounts ---------------------------------------------------------------

/**
 * A row of Better Auth's `user` table, restricted to the columns the admin UI
 * shows. SQLite stores emailVerified as 0/1 and the timestamps as text.
 */
export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number | null;
  image: string | null;
  role: string | null;
  createdAt: string;
}

export interface UserRepository {
  list(): UserRow[];
  findById(id: string): UserRow | undefined;
  /** How many accounts still hold the admin role. */
  countAdmins(): number;
  /** Drop an account's sessions so a revoked role takes effect immediately. */
  deleteSessions(userId: string): number;
}

// --- Legacy settings --------------------------------------------------------

/**
 * The pre-v3 key/value store. The only reader left is the boot-time seed, which
 * migrates a theme chosen under the old single-event schema onto the default
 * event row.
 */
export interface SettingsRepository {
  get(key: string): string | undefined;
}

/** Everything the services need from storage, assembled once at startup. */
export interface Repositories {
  events: EventRepository;
  rsvps: RsvpRepository;
  users: UserRepository;
  settings: SettingsRepository;
}
