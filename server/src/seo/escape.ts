// Escaping, for the two very different places this module writes text into.

/** Escape a value for interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/**
 * Serialize a JSON-LD payload for embedding in a <script> element.
 *
 * A script element's content is raw text, *not* parsed HTML: entities inside it
 * are never decoded, so HTML-escaping the payload would hand crawlers invalid
 * JSON. Escaping the three characters that could otherwise close the element
 * early as JSON \u sequences keeps the document safe and the JSON valid.
 */
export function escapeJsonLd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

