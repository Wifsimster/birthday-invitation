import { useCallback, useEffect, useState } from 'react';
import { eventsApi, ApiError } from '../api/index.js';
import { eventConfig } from '../env.js';
import { applySeo, eventSeo } from '../seo.js';
import { applyTheme, DEFAULT_THEME } from '../themes.js';
import { formatDate, parseEventDate } from '../views/invitation/date.js';

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
  const isDefault = !slug;

  const [event, setEvent] = useState(() => emptyEvent(isDefault));
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [notFound, setNotFound] = useState(false);
  const [rsvpClosed, setRsvpClosed] = useState(false);

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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, updateSeo]);

  return { slug: effectiveSlug, event, theme, notFound, rsvpClosed };
}
