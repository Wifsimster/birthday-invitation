// The other guests, as one of them may see them.
//
// The phone number is the guest's identity here exactly as it is on the RSVP
// form: the server answers 403 to anyone who has not confirmed their own
// attendance, which is the normal case for a decline — the panel then simply
// stays hidden rather than reporting an error nobody can act on.

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
