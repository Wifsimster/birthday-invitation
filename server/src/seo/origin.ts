const HOST_RE = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

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

export function indexingAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return !/^(0|false|no|off)$/i.test(String(env.SEO_ALLOW_INDEXING ?? '').trim());
}

