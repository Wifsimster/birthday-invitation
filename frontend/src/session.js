// Shared session state.
//
// The Better Auth client owns sign-in/sign-up; this module owns "who am I and
// what may I do", which the server answers on GET /api/me. Role is deliberately
// read from the server rather than the cookie: it can change (an admin grants
// or revokes access) while a session stays valid.
//
// State lives outside React — the route guard has to resolve it before any
// component mounts, and the imperative helpers below are called from event
// handlers. Components subscribe with `useSession()`.
import { useSyncExternalStore } from 'react';
import { apiBaseUrl } from './env.js';
import { authClient } from './auth-client.js';

const state = {
  // null until refresh() has run at least once, then null (signed out) or the
  // user object { id, name, email, image, emailVerified, role }.
  user: null,
  // False until the first refresh resolves, so guards can await it instead of
  // flashing the sign-in page at an already-signed-in visitor.
  ready: false
};

// useSyncExternalStore compares snapshots by identity, so hand out a frozen
// copy that is only replaced when something actually changed.
let snapshot = { ...state };
const listeners = new Set();

function commit() {
  snapshot = { ...state };
  listeners.forEach((notify) => notify());
}

function subscribe(notify) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Read the session outside React (guards, event handlers). */
export const getSession = () => snapshot;

/** Subscribe a component to the session. Re-renders on sign-in/out and role changes. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, getSession);
}

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
    commit();
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
  commit();
}

/** Which sign-in methods the deployment offers (cached for the page's life). */
let providersPromise = null;
export function authProviders() {
  providersPromise ??= fetch(`${apiBaseUrl}/auth-providers`, { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : { emailPassword: true, google: false }))
    .catch(() => ({ emailPassword: true, google: false }));
  return providersPromise;
}
