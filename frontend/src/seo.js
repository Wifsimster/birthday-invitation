// Client-side <head> upkeep.
//
// The server already injects the right title/description/Open Graph tags into
// the HTML shell for the first load (server/src/seo.ts) — that is what crawlers
// and chat link scrapers read. These helpers keep the head correct afterwards,
// once the event data has been fetched and across client-side navigation, so
// the browser tab, bookmarks and the native share sheet show the party rather
// than a generic title. Keep the copy in sync with server/src/seo.ts.

const SITE_NAME = "Invitation d'anniversaire";

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!value) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    const [name, key] = attr;
    el.setAttribute(name, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Apply a page's metadata. `url` defaults to the current location, minus any
 * query string, so the canonical stays a single clean address per invitation.
 */
export function applySeo({ title, description, robots = 'index, follow', url }) {
  const canonical = url || `${window.location.origin}${window.location.pathname}`;
  document.title = title;
  setMeta('meta[name="description"]', ['name', 'description'], description);
  setMeta('meta[name="robots"]', ['name', 'robots'], robots);
  setMeta('meta[property="og:title"]', ['property', 'og:title'], title);
  setMeta('meta[property="og:description"]', ['property', 'og:description'], description);
  setMeta('meta[property="og:site_name"]', ['property', 'og:site_name'], SITE_NAME);
  setMeta('meta[property="og:url"]', ['property', 'og:url'], canonical);
  setMeta('meta[name="twitter:title"]', ['name', 'twitter:title'], title);
  setMeta('meta[name="twitter:description"]', ['name', 'twitter:description'], description);
  setLink('canonical', canonical);
}

/** Title + description for one event. Mirrors buildEventMeta on the server. */
export function eventSeo({ person, age, formattedDate, time, town, location, rsvpClosed }) {
  if (!person) {
    return { title: SITE_NAME, description: 'Invitation d\'anniversaire en ligne avec réponse (RSVP) en un clic.' };
  }
  const years = String(age || '').trim();
  const title = years
    ? `Anniversaire de ${person} — ${years} ans | Invitation`
    : `Anniversaire de ${person} | Invitation`;
  const when = [formattedDate, time].filter(Boolean).join(' à ');
  const where = [location, town].filter(Boolean).join(', ');
  const description = [
    years ? `${person} fête ses ${years} ans !` : `${person} fête son anniversaire !`,
    when && `Rendez-vous ${when}.`,
    where && `${where}.`,
    rsvpClosed ? 'Les réponses sont closes.' : 'Réponds à l\'invitation en un clic.'
  ].filter(Boolean).join(' ');
  return { title, description };
}
