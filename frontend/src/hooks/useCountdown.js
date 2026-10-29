import { useEffect, useMemo, useState } from 'react';

const MINUTE_MS = 60000;
const DAY_MS = 86400000;

export function useCountdown(eventStart) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (!eventStart) return null;
    const diff = eventStart.getTime() - now;
    if (eventStart.toDateString() === new Date(now).toDateString()) {
      return { isToday: true, units: [], aria: "C'est aujourd'hui" };
    }
    if (diff <= 0) return { isPast: true, units: [], aria: 'La fête est passée' };

    const days = Math.floor(diff / DAY_MS);
    const hours = Math.floor((diff % DAY_MS) / 3600000);
    const minutes = Math.floor((diff % 3600000) / MINUTE_MS);
    return {
      days,
      hours,
      minutes,
      units: [
        { value: days, label: 'jours' },
        { value: hours, label: 'heures' },
        { value: minutes, label: 'min' }
      ],
      aria: `Encore ${days} jours`
    };
  }, [eventStart, now]);
}
