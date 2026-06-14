// Runtime configuration. Values are injected into window.ENV at container
// start (see infra/inject-env.sh); public/env.js provides dev defaults.
const ENV = (typeof window !== 'undefined' && window.ENV) || {};

export const apiBaseUrl = ENV.VITE_API_BASE_URL || '/api';

export const eventConfig = {
  birthdayPerson: ENV.VITE_BIRTHDAY_PERSON || '',
  age: parseInt(ENV.VITE_BIRTHDAY_AGE, 10) || 0,
  eventDate: ENV.VITE_EVENT_DATE ? new Date(ENV.VITE_EVENT_DATE) : new Date(),
  eventTime: ENV.VITE_EVENT_TIME || '',
  eventTown: ENV.VITE_EVENT_TOWN || '',
  eventLocation: ENV.VITE_EVENT_LOCATION || '',
  dresscode: ENV.VITE_DRESSCODE || ''
};
