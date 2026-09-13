// The metadata model: what one invitation page claims to be.
//
// Rendering it is html.ts's job; this module only decides the title, the
// description, the canonical URL, the share card and the JSON-LD payload.

import type { EventRow } from '../db.ts';
import { isRsvpClosed, eventConfigFromRow } from '../domain/event.ts';
import { ogImageAlt } from '../og-image.ts';

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  // Absolute URL of the share card, and its alt text. Absent when no origin is
  // known (a relative og:image is ignored by every scraper) or for a page with
  // no event behind it.
  ogImage?: { url: string; alt: string };
  // JSON-LD payload (schema.org Event), omitted when the event has no date.
  jsonLd?: Record<string, unknown>;
}

export const SITE_NAME = 'Invitation d\'anniversaire';

// Generic copy used for the /admin route and for a slug that matches no event —
// neither should ever be the target of a search result or a link preview.
export const FALLBACK_META: SeoMeta = {
  title: SITE_NAME,
  description: 'Invitation d\'anniversaire en ligne avec réponse (RSVP) en un clic.',
  canonical: '',
  robots: 'noindex, nofollow'
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d);
}

/** Path of an event's invitation, "/" for the default event. */
export function eventPath(row: EventRow): string {
  return row.is_default ? '/' : `/e/${encodeURIComponent(row.slug)}`;
}

/**
 * Metadata describing one event's invitation page.
 *
 * The description is what a guest actually sees under the link in a search
 * result or a chat preview, so it leads with the facts that decide whether they
 * tap: who, how old, when and where.
 */
export function buildEventMeta(row: EventRow, origin: string, allowIndex = true): SeoMeta {
  const person = row.person?.trim();
  if (!person) return { ...FALLBACK_META, canonical: origin ? `${origin}${eventPath(row)}` : '' };

  const age = String(row.age ?? '').trim();
  const title = age
    ? `Anniversaire de ${person} — ${age} ans | Invitation`
    : `Anniversaire de ${person} | Invitation`;

  const readableDate = formatDate(row.date);
  const when = [readableDate, row.time?.trim()].filter(Boolean).join(' à ');
  const where = [row.location?.trim(), row.town?.trim()].filter(Boolean).join(', ');
  const description = [
    age ? `${person} fête ses ${age} ans !` : `${person} fête son anniversaire !`,
    when && `Rendez-vous ${when}.`,
    where && `${where}.`,
    isRsvpClosed(eventConfigFromRow(row))
      ? 'Les réponses sont closes.'
      : 'Réponds à l\'invitation en un clic.'
  ].filter(Boolean).join(' ');

  const canonical = origin ? `${origin}${eventPath(row)}` : '';

  const meta: SeoMeta = {
    title,
    description,
    canonical,
    robots: allowIndex ? 'index, follow' : 'noindex, follow'
  };

  if (origin) {
    const slugPath = row.is_default
      ? '/api/og.png'
      : `/api/events/${encodeURIComponent(row.slug)}/og.png`;
    meta.ogImage = { url: `${origin}${slugPath}`, alt: ogImageAlt(row) };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    meta.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: age ? `Anniversaire de ${person} (${age} ans)` : `Anniversaire de ${person}`,
      description,
      startDate: row.date,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      ...(canonical ? { url: canonical } : {}),
      ...(meta.ogImage ? { image: meta.ogImage.url } : {}),
      ...(where
        ? {
            location: {
              '@type': 'Place',
              name: row.location?.trim() || row.town?.trim(),
              address: { '@type': 'PostalAddress', addressLocality: row.town?.trim() || undefined }
            }
          }
        : {})
    };
  }

  return meta;
}

