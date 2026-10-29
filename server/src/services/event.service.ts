import type { Actor } from '../domain/access.ts';
import { canManageEvent, visibleOwnerId } from '../domain/access.ts';
import { conflict, invalid, notFound } from '../domain/errors.ts';
import { type EventConfig, eventConfigFromRow, slugify } from '../domain/event.ts';
import type { EventRow } from '../db.ts';
import type { EventCounts, EventFields, EventRepository, SettingsRepository } from '../repositories/types.ts';
import { DEFAULT_THEME } from '../themes.ts';

const SLUG_MAX = 60;

export interface EventInput extends Partial<EventFields> {
  slug?: string;
}

export interface EventService {
  listFor(actor: Actor): (EventRow & EventCounts)[];
  requireManageable(actor: Actor, id: unknown): EventRow;
  requireBySlug(slug: string): EventRow;
  defaultEvent(): EventRow;
  defaultEventConfig(): EventConfig;
  create(actor: Actor, input: EventInput & { person: string }): EventRow;
  update(actor: Actor, id: unknown, input: EventInput): EventRow;
  setTheme(id: number, theme: string): void;
  remove(actor: Actor, id: unknown): number;
  seedDefault(cfg: EventConfig): EventRow;
}

export interface EventServiceDeps {
  events: EventRepository;
  settings: SettingsRepository;
  fallbackConfig: EventConfig;
}

export function createEventService({ events, settings, fallbackConfig }: EventServiceDeps): EventService {
  const uniqueSlug = (base: string, excludeId?: number): string => {
    const withSuffix = (suffix: string): string =>
      `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;

    if (!events.slugTaken(base, excludeId)) return base;
    for (let n = 2; n <= 999; n++) {
      const candidate = withSuffix(`-${n}`);
      if (!events.slugTaken(candidate, excludeId)) return candidate;
    }
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = withSuffix(`-${Math.random().toString(36).slice(2, 8)}`);
      if (!events.slugTaken(candidate, excludeId)) return candidate;
    }
    throw new Error('unable to derive a free event slug');
  };

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

    defaultEventConfig() {
      const row = events.findDefault();
      return row.person ? eventConfigFromRow(row) : fallbackConfig;
    },

    create(actor, input) {
      if (input.slug) {
        if (events.slugTaken(input.slug)) throw conflict('Ce lien est déjà utilisé');
      }
      const slug = input.slug ?? uniqueSlug(slugify(input.person));
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

    remove(actor, id) {
      const existing = requireManageable(actor, id);
      if (existing.is_default) {
        throw invalid("Impossible de supprimer l'événement par défaut");
      }
      return events.deleteById(existing.id);
    },

    seedDefault(cfg) {
      const row = events.findDefault();
      if (row.person || !cfg.person) return row;
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
