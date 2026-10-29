import type { EventRow, RsvpRow } from '../db.ts';
import type { Attending } from '../domain/rsvp.ts';

export interface EventCounts {
  responses: number;
  confirmations: number;
  declined: number;
  total_guests: number;
}

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
  findDefault(): EventRow;
  listAll(): EventRow[];
  listWithCounts(ownerId?: string): (EventRow & EventCounts)[];
  slugTaken(slug: string, exceptId?: number): boolean;
  insert(data: NewEvent): EventRow;
  update(id: number, data: EventFields & { slug: string }): EventRow | undefined;
  updateTheme(id: number, theme: string): void;
  deleteById(id: number): number;
  deleteByOwner(ownerId: string): number;
}

export interface RsvpCounts {
  total_responses: number;
  confirmations: number;
  declined: number;
  total_guests: number;
}

export type RsvpSummary = Pick<
  RsvpRow,
  'id' | 'attending' | 'name' | 'email' | 'phone' | 'guests' | 'dietary_restrictions' | 'message' | 'share_response'
>;

export interface SharedParticipant {
  name: string;
  guests: number;
}

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
  findByPhone(eventId: number, phone: string): RsvpRow | undefined;
  findSummaryByPhone(eventId: number, phone: string): RsvpSummary | undefined;
  findSummaryById(eventId: number, rsvpId: number): RsvpSummary | undefined;
  phoneTaken(eventId: number, phone: string, exceptRsvpId: number): boolean;
  insert(eventId: number, record: RsvpRecord): number;
  update(eventId: number, rsvpId: number, record: RsvpRecord): number;
  updateById(rsvpId: number, record: RsvpRecord): number;
  deleteById(eventId: number, rsvpId: number): number;
  sharedParticipants(eventId: number): SharedParticipant[];
}

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
  countAdmins(): number;
  deleteSessions(userId: string): number;
}

export interface SettingsRepository {
  get(key: string): string | undefined;
}

export interface Repositories {
  events: EventRepository;
  rsvps: RsvpRepository;
  users: UserRepository;
  settings: SettingsRepository;
}
