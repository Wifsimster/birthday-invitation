// A repeating background refresh that can be stopped for good.

import { useEffect, useRef } from 'react';

/**
 * Run `task` every `intervalMs`. The callback is read from a ref on each tick,
 * so the interval is installed once instead of being torn down and rebuilt
 * every time a dependency of the caller changes.
 *
 * `stop()` ends the polling permanently — the console uses it when the session
 * is gone, so the dashboard does not sit on an error spending the rate limit.
 */
export function usePoll(task, intervalMs) {
  const taskRef = useRef(task);
  taskRef.current = task;
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => taskRef.current(), intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [intervalMs]);

  return {
    stop() {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}
