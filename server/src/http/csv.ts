// RSVP rows as a CSV document (RFC 4180 quoting).

import type { RsvpRow } from '../db.ts';

const CSV_COLUMNS = [
  'id', 'name', 'attending', 'email', 'phone', 'guests', 'dietary_restrictions',
  'message', 'share_response', 'created_at', 'updated_at'
] as const;

function escape(value: unknown): string {
  if (value == null) return '';
  let str = String(value);
  // Neutralise CSV/Excel formula injection: a leading =,+,-,@,tab or CR makes
  // spreadsheets evaluate the cell. Prefix with a single quote to force text.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows: RsvpRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      CSV_COLUMNS.map((col) => escape((row as unknown as Record<string, unknown>)[col])).join(',')
    );
  }
  return lines.join('\r\n') + '\r\n';
}

/** UTF-8 BOM so spreadsheets render the accents in French names. */
export const CSV_BOM = '﻿';
