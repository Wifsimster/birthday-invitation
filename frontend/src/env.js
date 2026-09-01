// Runtime configuration. Values are injected into window.ENV at container
// start (see infra/inject-env.sh); public/env.js provides dev defaults.
const ENV = (typeof window !== 'undefined' && window.ENV) || {};

export const apiBaseUrl = ENV.VITE_API_BASE_URL || '/api';

export const eventConfig = {
  birthdayPerson: ENV.VITE_BIRTHDAY_PERSON || '',
  // Free text on the server (a TEXT column: "5", "18 mois"), so keep it as one.
  age: ENV.VITE_BIRTHDAY_AGE || '',
  // Left as the raw 'YYYY-MM-DD' string: `new Date()` on it would land on
  // midnight UTC, which renders as the previous day west of UTC. The view
  // parses it at local noon instead (see parseEventDate in Invitation.jsx).
  eventDate: ENV.VITE_EVENT_DATE || '',
  eventTime: ENV.VITE_EVENT_TIME || '',
  eventTown: ENV.VITE_EVENT_TOWN || '',
  eventLocation: ENV.VITE_EVENT_LOCATION || '',
  dresscode: ENV.VITE_DRESSCODE || '',
  rsvpDeadline: ENV.VITE_EVENT_RSVP_DEADLINE || ''
};
