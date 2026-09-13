// Where the page thinks it is served from, and whether it wants to be found.
//
// Both answers come from the environment first and the request second, because
// the request is the part a visitor controls.

// Only a plausible host:port is accepted from the request. The Host header is
// client-controlled, so an unvalidated value would let a visitor choose the
// canonical/og:url we advertise for the page.
const HOST_RE = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

/**
 * Public origin the page is served from, e.g. "https://leo.example.com".
 * Prefers the explicitly configured origin; falls back to the (validated)
 * request host so a plain `docker run` still emits usable absolute URLs.
 */
export function resolveOrigin(
  req: { protocol?: string; get(name: string): string | undefined },
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = env.PUBLIC_BASE_URL || env.BETTER_AUTH_URL || '';
  if (configured) return configured.replace(/\/+$/, '');
  const host = req.get('host') ?? '';
  if (!HOST_RE.test(host)) return '';
  return `${req.protocol || 'http'}://${host}`;
}

/** True unless the operator opted out of being indexed (SEO_ALLOW_INDEXING=false). */
export function indexingAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return !/^(0|false|no|off)$/i.test(String(env.SEO_ALLOW_INDEXING ?? '').trim());
}

