// Request validation.
//
// Every schema the API enforces, in one module, with the French messages the
// SPA shows verbatim. Routes call `parseBody`, which raises the same
// DomainError any other refusal does — so a rejected body travels the one path
// through the error middleware instead of each handler formatting its own 400.

import { z } from 'zod';
import { invalid } from '../domain/errors.ts';
import { ROLES } from '../auth.ts';
import { DEFAULT_THEME, THEME_IDS } from '../themes.ts';

const guestsMessage = (min: number) => `Le nombre d'invités doit être entre ${min} et 10`;

/** Bound free-text fields so a single request can't store unbounded data. */
const optionalText = (max: number) =>
  z.string().trim().max(max, `Texte trop long (max ${max} caractères)`).nullish();

export function rsvpSchema(opts: { requireAttending: boolean; minGuests: number }) {
  const attending = z.enum(['yes', 'no'], { error: 'Le statut de participation est requis' });
  return z.object({
    attending: opts.requireAttending ? attending : attending.optional(),
    name: z
      .string({ error: 'Le nom est requis' })
      .trim()
      .min(1, 'Le nom est requis')
      .max(100, 'Le nom est trop long (max 100 caractères)'),
    phone: z
      .string({ error: 'Le numéro de téléphone est requis' })
      .trim()
      .min(1, 'Le numéro de téléphone est requis')
      .max(30, 'Numéro de téléphone invalide'),
    email: z
      .string()
      .trim()
      .max(254, 'Email trop long')
      .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Email invalide')
      .nullish(),
    guests: z
      .number()
      .int()
      .min(opts.minGuests, guestsMessage(opts.minGuests))
      .max(10, guestsMessage(opts.minGuests))
      .optional(),
    dietary_restrictions: optionalText(500),
    message: optionalText(2000),
    // Opt-in: may this response be listed to the other confirmed guests?
    // Absent means "leave as is" on an update and "no" on a create, so a client
    // that predates the field never publishes anyone by accident.
    share_response: z.boolean().optional()
  });
}

/** Role assignment for the user-management routes. */
export const userRoleSchema = z.object({
  role: z.enum(ROLES, { error: 'Rôle inconnu' })
});

/**
 * Admin-selectable UI theme. Validated against the shared allow-list so the
 * stored value always maps to a known frontend theme.
 */
export const settingsSchema = z.object({
  theme: z.enum(THEME_IDS, { error: 'Thème inconnu' })
});

// A date is either empty or a strict YYYY-MM-DD.
const dateRegex = /^(\d{4}-\d{2}-\d{2})?$/;
// A slug is dash-separated lowercase alphanumerics with no leading/trailing dash.
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(60, 'Lien invalide')
  .regex(slugRegex, 'Lien invalide')
  .refine((v) => v !== 'default', 'Lien invalide')
  .refine((v) => !/^[0-9]+$/.test(v), 'Lien invalide');

// Shared event field validators (used by both create and update schemas).
const eventFields = {
  age: z.string().trim().max(20, 'Texte trop long (max 20 caractères)'),
  date: z.string().trim().regex(dateRegex, 'Date invalide (YYYY-MM-DD)'),
  time: z.string().trim().max(100, 'Texte trop long (max 100 caractères)'),
  town: z.string().trim().max(120, 'Texte trop long (max 120 caractères)'),
  location: z.string().trim().max(200, 'Texte trop long (max 200 caractères)'),
  dress_code: z.string().trim().max(200, 'Texte trop long (max 200 caractères)'),
  theme: z.enum(THEME_IDS, { error: 'Thème inconnu' }),
  rsvp_deadline: z.string().trim().regex(dateRegex, 'Date invalide (YYYY-MM-DD)')
};

const personField = z
  .string({ error: 'Le nom est requis' })
  .trim()
  .min(1, 'Le nom est requis')
  .max(100, 'Le nom est trop long (max 100 caractères)');

export const eventCreateSchema = z.object({
  person: personField,
  age: eventFields.age.optional().default(''),
  date: eventFields.date.optional().default(''),
  time: eventFields.time.optional().default(''),
  town: eventFields.town.optional().default(''),
  location: eventFields.location.optional().default(''),
  dress_code: eventFields.dress_code.optional().default(''),
  theme: eventFields.theme.optional().default(DEFAULT_THEME),
  rsvp_deadline: eventFields.rsvp_deadline.optional().default(''),
  slug: slugField.optional()
});

export const eventUpdateSchema = z.object({
  person: personField.optional(),
  age: eventFields.age.optional(),
  date: eventFields.date.optional(),
  time: eventFields.time.optional(),
  town: eventFields.town.optional(),
  location: eventFields.location.optional(),
  dress_code: eventFields.dress_code.optional(),
  theme: eventFields.theme.optional(),
  rsvp_deadline: eventFields.rsvp_deadline.optional(),
  slug: slugField.optional()
});

const FIELD_PRIORITY = [
  'name', 'person', 'phone', 'attending', 'guests', 'email', 'dietary_restrictions',
  'message', 'slug', 'theme', 'date', 'rsvp_deadline'
];

/**
 * Reduce a zod error to the single French message the API returns, picking the
 * field that matters first (matching the original hand-rolled order).
 */
type ZodIssue = z.ZodError['issues'][number];
export function firstError(error: z.ZodError): string {
  const rank = (issue: ZodIssue) => {
    const idx = FIELD_PRIORITY.indexOf(String(issue.path[0]));
    return idx === -1 ? FIELD_PRIORITY.length : idx;
  };
  const sorted = [...error.issues].sort((a, b) => rank(a) - rank(b));
  return sorted[0]?.message ?? 'Données invalides';
}

/** Parse a request body, raising the API's own 400 when it doesn't fit. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw invalid(firstError(parsed.error));
  return parsed.data;
}
