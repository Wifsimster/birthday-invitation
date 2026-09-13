// The event an invitation page shows.
//
// One hook owns the whole arrival sequence: paint the fallback theme, fetch the
// event, upgrade the theme, and refresh the document's metadata — in that order,
// because each step depends on the one before it.

import { useCallback, useEffect, useState } from 'react';
import { eventsApi, ApiError } from '../api/index.js';
import { eventConfig } from '../env.js';
import { applySeo, eventSeo } from '../seo.js';
import { applyTheme, DEFAULT_THEME } from '../themes.js';
import { formatDate, parseEventDate } from '../views/invitation/date.js';

/** The shape the view reads, whether it came from the API or from env.js. */
function emptyEvent(seed) {
  return {
    birthdayPerson: seed ? eventConfig.birthdayPerson : '',
    age: seed ? eventConfig.age : '',
    eventDate: seed ? parseEventDate(eventConfig.eventDate) : null,
    eventTime: seed ? eventConfig.eventTime : '',
    eventTown: seed ? eventConfig.eventTown : '',
    eventLocation: seed ? eventConfig.eventLocation : '',
    dresscode: seed ? eventConfig.dresscode : '',
    rsvpDeadline: seed ? eventConfig.rsvpDeadline : ''
  };
}

export function useInvitationEvent(slug) {
  const effectiveSlug = slug || 'default';
  // Only seed from the env.js fallback on the default route, to avoid a blank
  // flash; the API response is the source of truth and overrides this.
  const isDefault = !slug;

  const [event, setEvent] = useState(() => emptyEvent(isDefault));
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [notFound, setNotFound] = useState(false);
  const [rsvpClosed, setRsvpClosed] = useState(false);

  // Keep the tab title, the share sheet and the canonical URL in step with the
  // event actually on screen. The first paint's tags come from the server.
  const updateSeo = useCallback(
    (data) => {
      if (!data) {
        applySeo({
          title: 'Événement introuvable',
          description: "Cette invitation n'existe pas ou n'est plus disponible.",
          robots: 'noindex, follow'
        });
        return;
      }
      const { title, description } = eventSeo({
        person: data.birthdayPerson,
        age: data.age,
        formattedDate: formatDate(data.eventDate),
        time: data.eventTime,
        town: data.eventTown,
        location: data.eventLocation,
        rsvpClosed: data.rsvpClosed
      });
      applySeo({ title, description, image: eventsApi.ogImageUrl(slug) });
    },
    [slug]
  );

  // No updateSeo() on mount: the server already injected this event's tags into
  // the shell. Overwriting them with the seed values before the fetch lands
  // would only downgrade them (and lose them entirely if the fetch fails).
  useEffect(() => {
    let cancelled = false;
    applyTheme(DEFAULT_THEME);
    setNotFound(false);

    (async () => {
      try {
        const data = await eventsApi.publicEvent(effectiveSlug);
        if (cancelled) return;
        const next = {
          birthdayPerson: data.person || '',
          // Free-form on the server ("5", "18 mois"): keep the string so the
          // badge and the title match the share card instead of blanking on a
          // non-number.
          age: String(data.age ?? '').trim(),
          eventDate: parseEventDate(data.date),
          eventTime: data.time || '',
          eventTown: data.town || '',
          eventLocation: data.location || '',
          dresscode: data.dress_code || '',
          rsvpDeadline: data.rsvp_deadline || ''
        };
        setEvent(next);
        setRsvpClosed(!!data.rsvp_closed);
        if (data.theme) {
          setTheme(data.theme);
          applyTheme(data.theme);
        }
        updateSeo({ ...next, rsvpClosed: !!data.rsvp_closed });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          updateSeo(null);
          return;
        }
        // Keep whatever we have (the fallback paint) when the event can't be
        // fetched: an invitation that half-renders beats an error page.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, updateSeo]);

  return { slug: effectiveSlug, event, theme, notFound, rsvpClosed };
}
