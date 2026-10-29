import { createAuthClient } from 'better-auth/react';
import { apiBaseUrl } from './env.js';

function authBaseUrl() {
  try {
    return new URL(apiBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export const authClient = createAuthClient({ baseURL: authBaseUrl() });
