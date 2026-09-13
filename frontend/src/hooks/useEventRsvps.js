// The selected event's responses and their counters.

import { useCallback, useRef, useState } from 'react';
import { rsvpsApi } from '../api/index.js';

const NO_STATS = { total_responses: 0, confirmations: 0, declined: 0, total_guests: 0 };

export function useEventRsvps(onAccessError) {
  const [rsvps, setRsvps] = useState([]);
  const [stats, setStats] = useState(NO_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // The event the newest request was made for, so a slow answer for an event
  // the admin has since navigated away from cannot overwrite the one on screen.
  const requestedFor = useRef(null);

  const load = useCallback(
    async (eventId) => {
      if (!eventId) return;
      requestedFor.current = eventId;
      setLoading(true);
      setError(null);
      try {
        const [counts, list] = await Promise.all([
          rsvpsApi.countsFor(eventId),
          rsvpsApi.listFor(eventId)
        ]);
        if (requestedFor.current !== eventId) return;
        setStats({
          total_responses: counts.total_responses || 0,
          confirmations: counts.confirmations || 0,
          declined: counts.declined || 0,
          total_guests: counts.total_guests || 0
        });
        setRsvps(list);
      } catch (err) {
        if (await onAccessError(err)) return;
        if (requestedFor.current !== eventId) return;
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [onAccessError]
  );

  return { rsvps, stats, loading, error, load };
}
