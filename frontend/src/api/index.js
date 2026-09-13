// The API as the views see it: named operations, not URLs.
//
// Nothing above this layer knows a path, a verb or a status code. Renaming an
// endpoint, versioning it, or putting a retry in front of one is a change here.

import { apiBaseUrl } from '../env.js';
import { request } from './client.js';

export { ApiError } from './client.js';

const url = (path) => `${apiBaseUrl}${path}`;

// --- Events -----------------------------------------------------------------

export const eventsApi = {
  /** The invitations this account may manage, with their RSVP counters. */
  async list() {
    const data = await request(url('/events'), {
      fallback: 'Erreur lors de la récupération des événements'
    });
    return data.events || [];
  },

  create(payload) {
    return request(url('/events'), {
      method: 'POST',
      body: payload,
      fallback: 'Erreur lors de la création'
    });
  },

  update(id, payload) {
    return request(url(`/events/${id}`), {
      method: 'PUT',
      body: payload,
      fallback: 'Erreur lors de la modification'
    });
  },

  remove(id) {
    return request(url(`/events/${id}`), {
      method: 'DELETE',
      fallback: 'Erreur lors de la suppression'
    });
  },

  setTheme(id, theme) {
    return request(url(`/events/${id}`), {
      method: 'PUT',
      body: { theme },
      fallback: 'Erreur lors du changement de thème'
    });
  },

  /** Absolute URL of an event's Open Graph share card (a <meta>, not a fetch). */
  ogImageUrl(slug) {
    const path = slug ? `/events/${encodeURIComponent(slug)}/og.png` : '/og.png';
    return new URL(url(path), window.location.origin).href;
  },

  /** The public invitation payload for a slug ('default' for the main one). */
  publicEvent(slug) {
    return request(url(`/events/${encodeURIComponent(slug)}`), {
      fallback: "Erreur lors du chargement de l'invitation"
    });
  }
};

// --- RSVPs ------------------------------------------------------------------

export const rsvpsApi = {
  async listFor(eventId) {
    const data = await request(url(`/events/${eventId}/rsvps`), {
      fallback: 'Erreur lors de la récupération des données'
    });
    return data.rsvps || [];
  },

  countsFor(eventId) {
    return request(url(`/events/${eventId}/rsvps/count`), {
      fallback: 'Erreur lors de la récupération des données'
    });
  },

  /** The CSV export is a browser navigation, so this is a URL by design. */
  exportUrl(eventId) {
    return url(`/events/${eventId}/rsvps/export.csv`);
  },

  add(eventId, payload) {
    return request(url(`/events/${eventId}/rsvps`), {
      method: 'POST',
      body: payload,
      fallback: "Erreur lors de l'ajout"
    });
  },

  edit(eventId, rsvpId, payload) {
    return request(url(`/events/${eventId}/rsvp/${rsvpId}`), {
      method: 'PUT',
      body: payload,
      fallback: 'Erreur lors de la modification'
    });
  },

  remove(eventId, rsvpId) {
    return request(url(`/events/${eventId}/rsvp/${rsvpId}`), {
      method: 'DELETE',
      fallback: 'Erreur lors de la suppression'
    });
  },

  /** A guest submitting (or updating) their own answer. */
  submit(slug, payload) {
    return request(url(`/events/${encodeURIComponent(slug)}/rsvp`), {
      method: 'POST',
      body: payload,
      fallback: "Erreur lors de l'envoi"
    });
  },

  /** A guest retrieving the answer they already gave, by phone number. */
  lookup(slug, phone) {
    return request(
      url(`/events/${encodeURIComponent(slug)}/rsvp/lookup/${encodeURIComponent(phone)}`),
      { fallback: 'Erreur lors de la recherche' }
    );
  },

  /** Who else is coming, as answered to a confirmed guest. */
  participants(slug, phone) {
    return request(
      url(`/events/${encodeURIComponent(slug)}/participants/${encodeURIComponent(phone)}`),
      { fallback: 'Erreur lors du chargement de la liste' }
    );
  },

  /** The event's calendar invite — a download link, not a fetch. */
  icsUrl(slug) {
    return url(`/events/${encodeURIComponent(slug)}/event.ics`);
  }
};

// --- Accounts ---------------------------------------------------------------

export const usersApi = {
  async list() {
    const data = await request(url('/users'), { fallback: 'Chargement des comptes impossible' });
    return data.users || [];
  },

  setRole(userId, role) {
    return request(url(`/users/${userId}/role`), {
      method: 'PUT',
      body: { role },
      fallback: 'Modification impossible'
    });
  },

  remove(userId) {
    return request(url(`/users/${userId}`), {
      method: 'DELETE',
      fallback: 'Suppression impossible'
    });
  }
};

// --- The signed-in account ---------------------------------------------------

export const accountApi = {
  /** The current account and its granted role, or null when signed out. */
  async me() {
    const data = await request(url('/me'), { fallback: 'Session indisponible' });
    return data.user ?? null;
  },

  /** Which sign-in methods this deployment offers. */
  providers() {
    return request(url('/auth-providers'), { fallback: 'Configuration indisponible' });
  }
};
