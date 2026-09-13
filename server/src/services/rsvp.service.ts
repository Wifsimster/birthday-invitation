// RSVP use-cases.
//
// The same three write paths exist twice in the HTTP surface — once on the
// legacy un-slugged routes and once per event — and used to be copied line for
// line, which is how the two drifted (one normalised a decline's guest count,
// the other did not). Both surfaces now call the functions below with an event
// id, so a rule changes in one place.

import { forbidden, conflict, invalid, notFound } from '../domain/errors.ts';
import { type EventConfig, isRsvpClosed } from '../domain/event.ts';
import { type Attending, guestCount, normalizePhone, optionalText, shareFlag } from '../domain/rsvp.ts';
import type { RsvpRow } from '../db.ts';
import type {
  RsvpCounts, RsvpRecord, RsvpRepository, RsvpSummary, SharedParticipant
} from '../repositories/types.ts';

/** A validated response body, as every write path receives it. */
export interface RsvpInput {
  attending?: Attending;
  name: string;
  phone: string;
  email?: string | null;
  guests?: number;
  dietary_restrictions?: string | null;
  message?: string | null;
  share_response?: boolean;
}

/** What the guest list answers a confirmed guest asking who else is coming. */
export interface SharedGuestList extends Pick<RsvpCounts, 'confirmations' | 'total_guests'> {
  participants: SharedParticipant[];
  shared_count: number;
  shared_guests: number;
  you_share: boolean;
}

export interface SubmitResult {
  id: number;
  created: boolean;
}

export interface RsvpService {
  list(eventId: number): RsvpRow[];
  counts(eventId: number): RsvpCounts;
  lookup(eventId: number, phone: string): RsvpSummary;
  /** The guest's own submission: one response per (event, phone), upserted. */
  submit(eventId: number, config: EventConfig, input: RsvpInput, ip: string | null): SubmitResult;
  /** An admin recording a reply taken by phone or in person. */
  add(eventId: number, input: RsvpInput): number;
  /** An admin editing a stored response. Returns the number of rows changed. */
  edit(eventId: number, rsvpId: unknown, input: RsvpInput): number;
  remove(eventId: number, rsvpId: unknown): number;
  sharedGuests(eventId: number, rawPhone: string): SharedGuestList;
}

const PHONE_REQUIRED = 'Le numéro de téléphone est requis';
const PHONE_TAKEN = 'Une réponse existe déjà pour ce numéro';
const RSVP_NOT_FOUND = 'RSVP non trouvé';

export function createRsvpService(rsvps: RsvpRepository): RsvpService {
  // A phone number the guest actually gave, normalised. Empty is a 400 rather
  // than a row nobody can ever look up again.
  const requirePhone = (raw: unknown): string => {
    const phone = normalizePhone(raw);
    if (!phone) throw invalid(PHONE_REQUIRED);
    return phone;
  };

  // A path parameter as a row id. Junk stays a 404 rather than letting NaN reach
  // a comparison that silently never matches.
  const requireRsvpId = (raw: unknown): number => {
    const id = Number(raw);
    if (!Number.isInteger(id)) throw notFound(RSVP_NOT_FOUND);
    return id;
  };

  const record = (
    input: RsvpInput,
    attending: Attending,
    phone: string,
    share: number,
    ip: string | null = null
  ): RsvpRecord => ({
    attending,
    name: input.name,
    email: optionalText(input.email),
    phone,
    guests: guestCount(attending, input.guests),
    dietary_restrictions: optionalText(input.dietary_restrictions),
    message: optionalText(input.message),
    share_response: share,
    ip_address: ip
  });

  return {
    list(eventId) {
      return rsvps.listByEvent(eventId);
    },

    counts(eventId) {
      return rsvps.countsByEvent(eventId);
    },

    lookup(eventId, rawPhone) {
      const phone = requirePhone(rawPhone);
      const row = rsvps.findSummaryByPhone(eventId, phone);
      if (!row) throw notFound('Aucune réponse trouvée pour ce numéro de téléphone');
      return row;
    },

    submit(eventId, config, input, ip) {
      if (isRsvpClosed(config)) {
        throw forbidden('Les réponses sont closes pour cet événement.');
      }
      const phone = requirePhone(input.phone);
      const attending = input.attending as Attending;
      const existing = rsvps.findByPhone(eventId, phone);
      const share = shareFlag(attending, input.share_response, Boolean(existing?.share_response));
      const data = record(input, attending, phone, share, ip);

      if (existing) {
        rsvps.updateById(existing.id, data);
        return { id: existing.id, created: false };
      }
      return { id: rsvps.insert(eventId, data), created: true };
    },

    add(eventId, input) {
      const phone = requirePhone(input.phone);
      if (rsvps.findByPhone(eventId, phone)) throw conflict(PHONE_TAKEN);
      const attending = input.attending as Attending;
      return rsvps.insert(eventId, record(input, attending, phone, shareFlag(attending, input.share_response)));
    },

    edit(eventId, rawRsvpId, input) {
      const rsvpId = requireRsvpId(rawRsvpId);
      const phone = requirePhone(input.phone);
      // Phone is the guest identity, and (event_id, phone) is a UNIQUE index:
      // moving a response onto a number another guest already used would raise a
      // constraint error and surface as an opaque 500. Answer like `add` does.
      if (rsvps.phoneTaken(eventId, phone, rsvpId)) throw conflict(PHONE_TAKEN);

      // The guest's own consent is not the admin's to flip by accident: an edit
      // that omits the field keeps whatever the guest chose.
      const current = rsvps.findSummaryById(eventId, rsvpId);
      const attending = input.attending ?? 'yes';
      const stored = Boolean(current?.share_response);
      const changes = rsvps.update(
        eventId,
        rsvpId,
        record(input, attending, phone, shareFlag(attending, input.share_response, stored))
      );
      if (changes === 0) throw notFound(RSVP_NOT_FOUND);
      return changes;
    },

    remove(eventId, rawRsvpId) {
      const rsvpId = requireRsvpId(rawRsvpId);
      const changes = rsvps.deleteById(eventId, rsvpId);
      if (changes === 0) throw notFound(RSVP_NOT_FOUND);
      return changes;
    },

    // Who else is coming, as seen by a guest. Two rules keep this from becoming
    // a public directory of the invitation:
    //   * the caller has to prove they are a confirmed guest of that event by
    //     giving the phone number they answered with (the same identity the RSVP
    //     form uses), and
    //   * only the responses whose owner ticked "partager ma réponse" are
    //     listed, with just the name and the party size — never a phone, an
    //     email, a message or a dietary restriction.
    sharedGuests(eventId, rawPhone) {
      const phone = requirePhone(rawPhone);
      const viewer = rsvps.findSummaryByPhone(eventId, phone);
      if (!viewer || viewer.attending !== 'yes') {
        // One answer for "never answered" and for "answered no", so the endpoint
        // cannot be used to test whether a number is on the guest list.
        throw forbidden('Cette liste est réservée aux invités ayant confirmé leur venue.', {
          code: 'not_attending'
        });
      }
      const participants = rsvps.sharedParticipants(eventId);
      const counts = rsvps.countsByEvent(eventId);
      return {
        participants,
        shared_count: participants.length,
        shared_guests: participants.reduce((sum, row) => sum + (row.guests || 0), 0),
        // Aggregates over *every* confirmation, so the list can say how many of
        // the confirmed guests chose to appear in it. No identity attached.
        confirmations: counts.confirmations,
        total_guests: counts.total_guests,
        you_share: viewer.share_response === 1
      };
    }
  };
}
