// SQLite-backed event storage. The only module that writes the `event` table.

import type { Db, EventRow } from '../db.ts';
import type { EventCounts, EventFields, EventRepository, NewEvent } from './types.ts';

export function createEventRepository(db: Db): EventRepository {
  const findById = (id: number): EventRow | undefined =>
    db.get<EventRow>('SELECT * FROM event WHERE id = ?', [id]);

  return {
    findById,

    findBySlug(slug) {
      return db.get<EventRow>('SELECT * FROM event WHERE slug = ?', [slug]);
    },

    // Prefer the flagged row; fall back to the lowest id if (somehow) none is
    // flagged. Should never happen once initSchema has run, but the legacy
    // routes all resolve through here, so stay defensive rather than throwing.
    findDefault() {
      const row =
        db.get<EventRow>('SELECT * FROM event WHERE is_default = 1 ORDER BY id LIMIT 1') ??
        db.get<EventRow>('SELECT * FROM event ORDER BY id LIMIT 1');
      if (row) return row;
      db.run("INSERT OR IGNORE INTO event (slug, is_default) VALUES ('default', 1)");
      db.run("UPDATE event SET is_default = 1 WHERE slug = 'default'");
      return db.get<EventRow>('SELECT * FROM event WHERE is_default = 1 ORDER BY id LIMIT 1') as EventRow;
    },

    listAll() {
      return db.all<EventRow>('SELECT * FROM event ORDER BY is_default DESC, id');
    },

    listWithCounts(ownerId) {
      const mine = ownerId !== undefined;
      return db.all<EventRow & EventCounts>(`
        SELECT e.*,
          (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id) AS responses,
          (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'yes') AS confirmations,
          (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'no') AS declined,
          (SELECT COALESCE(SUM(r.guests), 0) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'yes') AS total_guests
        FROM event e
        ${mine ? 'WHERE e.owner_id = ?' : ''}
        ORDER BY e.is_default DESC, e.created_at DESC, e.id DESC
      `, mine ? [ownerId] : []);
    },

    slugTaken(slug, exceptId) {
      const row = db.get<{ id: number }>('SELECT id FROM event WHERE slug = ?', [slug]);
      return !!row && row.id !== exceptId;
    },

    insert(data: NewEvent) {
      const result = db.run(`
        INSERT INTO event (slug, person, age, date, time, town, location, dress_code, theme, rsvp_deadline, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.slug, data.person, data.age, data.date, data.time, data.town,
        data.location, data.dress_code, data.theme, data.rsvp_deadline, data.owner_id
      ]);
      return findById(Number(result.lastID)) as EventRow;
    },

    update(id, data: EventFields & { slug: string }) {
      db.run(`
        UPDATE event
        SET slug = ?, person = ?, age = ?, date = ?, time = ?, town = ?, location = ?,
            dress_code = ?, theme = ?, rsvp_deadline = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        data.slug, data.person, data.age, data.date, data.time, data.town,
        data.location, data.dress_code, data.theme, data.rsvp_deadline, id
      ]);
      return findById(id);
    },

    updateTheme(id, theme) {
      db.run('UPDATE event SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [theme, id]);
    },

    deleteById(id) {
      return db.run('DELETE FROM event WHERE id = ?', [id]).changes;
    },

    deleteByOwner(ownerId) {
      return db.run('DELETE FROM event WHERE owner_id = ?', [ownerId]).changes;
    }
  };
}
