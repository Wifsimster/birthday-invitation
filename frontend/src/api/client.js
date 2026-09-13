// The one place the app talks HTTP.
//
// Views used to call `fetch` with a hand-built URL and repeat the same five
// lines afterwards — credentials, `res.ok`, pull `error` out of the body, fall
// back to a French message, throw. Every one of those was a chance to forget
// the cookie or to surface `[object Object]` in a toast. The helpers below own
// that shape; the modules beside this one name the endpoints; the components
// call functions and handle results.

/** A failed request, carrying the status so callers can branch on 401/403. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The API's own French message when it sent one, else the caller's fallback. */
async function errorFrom(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return new ApiError(res.status, body.error || fallback);
}

/**
 * Perform a request against the API.
 *
 * Resolves with the parsed body, or rejects with an ApiError. `fallback` is the
 * message shown when the server answered without one (a proxy error page, a
 * dropped connection mid-response).
 */
export async function request(url, { method = 'GET', body, fallback = 'Une erreur est survenue' } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    });
  } catch {
    // Offline, DNS, a dropped connection: never a status, so give it one the
    // callers can still branch on.
    throw new ApiError(0, fallback);
  }
  if (!res.ok) throw await errorFrom(res, fallback);
  // 204 and friends carry no body; asking for JSON would throw on empty text.
  return res.status === 204 ? null : res.json();
}
