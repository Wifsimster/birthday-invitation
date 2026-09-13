// Event use-cases: what an account may list, create, rename, re-theme or
// delete, plus the boot-time seed of the default invitation.
//
// The ownership rules live in domain/access.ts and the SQL in the repository —
// this layer is the sequence of steps and the failures they can raise.

import type { Actor } from '../domain/access.ts';
import { canManageEvent, visibleOwnerId } from '../domain/access.ts';
import { conflict, invalid, notFound } from '../domain/errors.ts';
import { type EventConfig, eventConfigFromRow, slugify } from '../domain/event.ts';
import type { EventRow } from '../db.ts';
import type { EventCounts, EventFields, EventRepository, SettingsRepository } from '../repositories/types.ts';
import { DEFAULT_THEME } from '../themes.ts';

// The slug column's length budget, mirrored by the `slugField` validator.
const SLUG_MAX = 60;

export interface EventInput extends Partial<EventFields> {
  slug?: string;
}

export interface EventService {
  listFor(actor: Actor): (EventRow & EventCounts)[];
  /** The event named by `id` when this account may manage it, else a 404. */
  requireManageable(actor: Actor, id: unknown): EventRow;
  requireBySlug(slug: string): EventRow;
  defaultEvent(): EventRow;
  /** The default event as the legacy routes read it (deadline, calendar). */
  defaultEventConfig(): EventConfig;
  create(actor: Actor, input: EventInput & { person: string }): EventRow;
  update(actor: Actor, id: unknown, input: EventInput): EventRow;
  setTheme(id: number, theme: string): void;
  remove(actor: Actor, id: unknown): number;
  /** Seed/repair the default event from the environment configuration. */
  seedDefault(cfg: EventConfig): EventRow;
}

export interface EventServiceDeps {
  events: EventRepository;
  settings: SettingsRepository;
  /** Fallback configuration for a default row that was never seeded. */
  fallbackConfig: EventConfig;
}

export function createEventService({ events, settings, fallbackConfig }: EventServiceDeps): EventService {
  /**
   * Pick a free slug derived from a base, appending -2, -3… until unused.
   * `excludeId` lets an update keep its own slug.
   *
   * Truncating `${base}-${n}` back to the column budget can reproduce `base`
   * itself once the base is at (or one character under) that budget — every
   * candidate then equals the slug we already know is taken, and the loop spins
   * forever, wedging the whole (single-threaded) server on one request. Trim the
   * base first so the suffix always survives the truncation.
   */
  const uniqueSlug = (base: string, excludeId?: number): string => {
    const withSuffix = (suffix: string): string =>
      `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;

    if (!events.slugTaken(base, excludeId)) return base;
    for (let n = 2; n <= 999; n++) {
      const candidate = withSuffix(`-${n}`);
      if (!events.slugTaken(candidate, excludeId)) return candidate;
    }
    // 998 events sharing one name is not a real deployment, but the fallback
    // still has to terminate: try a handful of random suffixes, then give up
    // loudly rather than looping.
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = withSuffix(`-${Math.random().toString(36).slice(2, 8)}`);
      if (!events.slugTaken(candidate, excludeId)) return candidate;
    }
    throw new Error('unable to derive a free event slug');
  };

  // Someone else's event is a 404 rather than a 403 so the API never confirms
  // which ids exist to an account that cannot see them.
  const requireManageable = (actor: Actor, raw: unknown): EventRow => {
    const id = Number(raw);
    const row = Number.isInteger(id) ? events.findById(id) : undefined;
    if (!row || !canManageEvent(actor, row)) throw notFound('Événement introuvable');
    return row;
  };

  return {
    listFor(actor) {
      return events.listWithCounts(visibleOwnerId(actor));
    },

    requireManageable,

    requireBySlug(slug) {
      const row = events.findBySlug(slug);
      if (!row) throw notFound('Événement introuvable');
      return row;
    },

    defaultEvent() {
      return events.findDefault();
    },

    // The stored row wins: it is seeded from the env config at boot and is what
    // the admin UI edits afterwards, so an edited date or RSVP deadline has to
    // reach the legacy routes too — otherwise /api/rsvp and
    // /api/events/default/rsvp disagree about whether the same event is still
    // open. The injected config is only the fallback for a row never seeded.
    defaultEventConfig() {
      const row = events.findDefault();
      return row.person ? eventConfigFromRow(row) : fallbackConfig;
    },

    // Slug derives from the person's name when not provided and is made unique
    // by appending -2, -3… An explicitly-provided taken slug is a conflict.
    create(actor, input) {
      if (input.slug) {
        if (events.slugTaken(input.slug)) throw conflict('Ce lien est déjà utilisé');
      }
      const slug = input.slug ?? uniqueSlug(slugify(input.person));
      // The creator owns the invitation, which is what lets one account run
      // several of them and see only its own.
      return events.insert({
        slug,
        person: input.person,
        age: input.age ?? '',
        date: input.date ?? '',
        time: input.time ?? '',
        town: input.town ?? '',
        location: input.location ?? '',
        dress_code: input.dress_code ?? '',
        theme: input.theme ?? DEFAULT_THEME,
        rsvp_deadline: input.rsvp_deadline ?? '',
        owner_id: actor.id
      });
    },

    // Partial update. The default event's slug is fixed; other events may change
    // it but must stay unique. is_default is never editable.
    update(actor, id, input) {
      const existing = requireManageable(actor, id);
      let slug = existing.slug;
      if (input.slug !== undefined && !existing.is_default && input.slug !== existing.slug) {
        if (events.slugTaken(input.slug, existing.id)) throw conflict('Ce lien est déjà utilisé');
        slug = input.slug;
      }
      return events.update(existing.id, {
        slug,
        person: input.person ?? existing.person,
        age: input.age ?? existing.age,
        date: input.date ?? existing.date,
        time: input.time ?? existing.time,
        town: input.town ?? existing.town,
        location: input.location ?? existing.location,
        dress_code: input.dress_code ?? existing.dress_code,
        theme: input.theme ?? existing.theme,
        rsvp_deadline: input.rsvp_deadline ?? existing.rsvp_deadline
      }) as EventRow;
    },

    setTheme(id, theme) {
      events.updateTheme(id, theme);
    },

    // The default event cannot be removed; every other event takes its RSVPs
    // with it through the event_id cascade.
    remove(actor, id) {
      const existing = requireManageable(actor, id);
      if (existing.is_default) {
        throw invalid("Impossible de supprimer l'événement par défaut");
      }
      return events.deleteById(existing.id);
    },

    // Flow an env-configured deployment's settings into the default row on first
    // boot. Once an admin edits the event (person becomes non-empty) boot never
    // clobbers it.
    seedDefault(cfg) {
      const row = events.findDefault();
      if (row.person || !cfg.person) return row;
      // Migrate any legacy global theme stored in the settings table.
      const theme = settings.get('theme') || row.theme;
      return events.update(row.id, {
        slug: row.slug,
        person: cfg.person,
        age: cfg.age || '',
        date: cfg.date || '',
        time: cfg.time || '',
        town: cfg.town || '',
        location: cfg.location || '',
        dress_code: cfg.dressCode || '',
        theme,
        rsvp_deadline: cfg.rsvpDeadline || ''
      }) as EventRow;
    }
  };
}
