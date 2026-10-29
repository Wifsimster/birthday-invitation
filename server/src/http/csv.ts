import type { RsvpRow } from '../db.ts';

const CSV_COLUMNS = [
  'id', 'name', 'attending', 'email', 'phone', 'guests', 'dietary_restrictions',
  'message', 'share_response', 'created_at', 'updated_at'
] as const;

function escape(value: unknown): string {
  if (value == null) return '';
  let str = String(value);
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

export const CSV_BOM = '﻿';
