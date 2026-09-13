// The account's invitations, as the console holds them.

import { useCallback, useState } from 'react';
import { eventsApi } from '../api/index.js';

export function useEvents(onAccessError) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** Reload the list. Resolves with it, or with null when the load failed. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await eventsApi.list();
      setEvents(list);
      return list;
    } catch (err) {
      if (await onAccessError(err)) return null;
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onAccessError]);

  /** Patch one event in place, so a saved theme shows without a round trip. */
  const patch = useCallback((id, fields) => {
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, ...fields } : e)));
  }, []);

  return { events, loading, error, load, patch };
}
