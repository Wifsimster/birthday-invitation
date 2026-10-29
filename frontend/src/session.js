import { useSyncExternalStore } from 'react';
import { accountApi } from './api/index.js';
import { authClient } from './auth-client.js';

const state = {
  user: null,
  ready: false
};

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

export const getSession = () => snapshot;

export function useSession() {
  return useSyncExternalStore(subscribe, getSession, getSession);
}

export const isSignedIn = () => state.user !== null;
export const isAdmin = () => state.user?.role === 'admin';

export async function refresh() {
  try {
    state.user = await accountApi.me();
  } catch {
    state.user = null;
  } finally {
    state.ready = true;
    commit();
  }
  return state.user;
}

export async function ensureSession() {
  if (!state.ready) await refresh();
  return state.user;
}

export async function signOut() {
  try {
    await authClient.signOut();
  } catch {
  }
  state.user = null;
  state.ready = true;
  commit();
}

const DEFAULT_PROVIDERS = { emailPassword: true, google: false };
let providersPromise = null;
export function authProviders() {
  providersPromise ??= accountApi.providers().catch(() => DEFAULT_PROVIDERS);
  return providersPromise;
}
