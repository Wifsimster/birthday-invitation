// Better Auth browser client for the admin email/password login.
//
// The server mounts Better Auth at <api-origin>/api/auth. `apiBaseUrl` is the
// API root (e.g. "/api" for the same-origin SPA, or an absolute URL when the
// frontend talks to a separate backend). We resolve it to an origin and let the
// client's default basePath ("/api/auth") rebuild the full path.
import { createAuthClient } from 'better-auth/vue';
import { apiBaseUrl } from './env.js';

function authBaseUrl() {
  try {
    return new URL(apiBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export const authClient = createAuthClient({ baseURL: authBaseUrl() });
