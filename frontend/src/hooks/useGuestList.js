import { useCallback, useState } from 'react';
import { ApiError, rsvpsApi } from '../api/index.js';

export function useGuestList(slug) {
  const [list, setList] = useState(null);
  const [state, setState] = useState('idle');

  const load = useCallback(
    async (phone) => {
      const identity = String(phone ?? '').trim();
      if (!identity) return;
      setState('loading');
      try {
        setList(await rsvpsApi.participants(slug, identity));
        setState('ready');
      } catch (err) {
        setList(null);
        setState(err instanceof ApiError && err.status === 403 ? 'idle' : 'error');
      }
    },
    [slug]
  );

  const clear = useCallback(() => {
    setList(null);
    setState('idle');
  }, []);

  return { list, state, load, clear };
}
