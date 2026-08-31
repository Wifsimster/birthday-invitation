// Shared reactive session state.
//
// The Better Auth client owns sign-in/sign-up; this module owns "who am I and
// what may I do", which the server answers on GET /api/me. Role is deliberately
// read from the server rather than the cookie: it can change (an admin grants
// or revokes access) while a session stays valid.
import { reactive, readonly } from 'vue';
import { apiBaseUrl } from './env.js';
import { authClient } from './auth-client.js';

const state = reactive({
  // null until refresh() has run at least once, then null (signed out) or the
  // user object { id, name, email, image, emailVerified, role }.
  user: null,
  // False until the first refresh resolves, so guards can await it instead of
  // flashing the sign-in page at an already-signed-in visitor.
  ready: false
});

export const session = readonly(state);

export const isSignedIn = () => state.user !== null;
export const isAdmin = () => state.user?.role === 'admin';

/** Re-read the current account from the server. Returns the user, or null. */
export async function refresh() {
  try {
    const res = await fetch(`${apiBaseUrl}/me`, { credentials: 'include' });
    state.user = res.ok ? (await res.json()).user : null;
  } catch {
    // Offline or the API is down: treat as signed out rather than trapping the
    // visitor on a spinner.
    state.user = null;
  } finally {
    state.ready = true;
  }
  return state.user;
}

/** Resolve the session once, reusing the result for later guard runs. */
export async function ensureSession() {
  if (!state.ready) await refresh();
  return state.user;
}

export async function signOut() {
  try {
    await authClient.signOut();
  } catch {
    // Best-effort: drop local state even when the network call fails.
  }
  state.user = null;
  state.ready = true;
}

/** Which sign-in methods the deployment offers (cached for the page's life). */
let providersPromise = null;
export function authProviders() {
  providersPromise ??= fetch(`${apiBaseUrl}/auth-providers`, { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : { emailPassword: true, google: false }))
    .catch(() => ({ emailPassword: true, google: false }));
  return providersPromise;
}
