// What the console does when a call comes back 401 or 403.
//
// The two statuses mean different things here. 401 is the session itself
// ending: the visitor goes back to the sign-in form. 403 only comes from the
// admin-only account routes, so it means an admin demoted this account while
// the tab was open — it keeps its own invitations, so re-read the session (the
// tab list follows the fresh role and drops "Accès") and leave the dashboard
// where it is.

import { useCallback } from 'react';
import { ApiError } from '../api/index.js';
import { refresh } from '../session.js';

/**
 * Returns a handler for a caught error: `true` when it was an access failure
 * and has been dealt with, `false` when the caller should surface it.
 * `onSessionLost` runs when the session is really gone.
 */
export function useSessionRecovery(onSessionLost) {
  return useCallback(
    async (err) => {
      if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) return false;
      const user = await refresh();
      if (user && err.status === 403) return true;
      onSessionLost();
      return true;
    },
    [onSessionLost]
  );
}
