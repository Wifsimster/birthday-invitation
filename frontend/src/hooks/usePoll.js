import { useEffect, useRef } from 'react';

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
