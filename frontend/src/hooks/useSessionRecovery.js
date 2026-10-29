import { useCallback } from 'react';
import { ApiError } from '../api/index.js';
import { refresh } from '../session.js';

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
