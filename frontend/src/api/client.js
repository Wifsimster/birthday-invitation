export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function errorFrom(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return new ApiError(res.status, body.error || fallback);
}

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
    throw new ApiError(0, fallback);
  }
  if (!res.ok) throw await errorFrom(res, fallback);
  return res.status === 204 ? null : res.json();
}
