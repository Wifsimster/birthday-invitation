// SQLite-backed RSVP storage. The only module that writes the `rsvp` table.

import type { Db, RsvpRow } from '../db.ts';
import type { RsvpCounts, RsvpRecord, RsvpRepository, RsvpSummary, SharedParticipant } from './types.ts';

// The columns the guest's own form reads back — never the stored ip_address or
// the internal timestamps.
const SUMMARY_COLUMNS =
  'id, attending, name, email, phone, guests, dietary_restrictions, message, share_response';

export function createRsvpRepository(db: Db): RsvpRepository {
  const writeValues = (record: RsvpRecord): unknown[] => [
    record.attending,
    record.name,
    record.email,
    record.phone,
    record.guests,
    record.dietary_restrictions,
    record.message,
    record.share_response
  ];

  return {
    listByEvent(eventId) {
      return db.all<RsvpRow>(
        'SELECT * FROM rsvp WHERE event_id = ? ORDER BY created_at DESC, id DESC',
        [eventId]
      );
    },

    countsByEvent(eventId) {
      const stats = db.get<RsvpCounts>(`
        SELECT
          COUNT(*) AS total_responses,
          SUM(CASE WHEN attending = 'yes' THEN 1 ELSE 0 END) AS confirmations,
          SUM(CASE WHEN attending = 'no' THEN 1 ELSE 0 END) AS declined,
          SUM(CASE WHEN attending = 'yes' THEN guests ELSE 0 END) AS total_guests
        FROM rsvp WHERE event_id = ?
      `, [eventId]);
      // SUM over no rows is NULL, and COUNT can only be a number: coalesce both
      // so the API always answers with four integers.
      return {
        total_responses: stats?.total_responses || 0,
        confirmations: stats?.confirmations || 0,
        declined: stats?.declined || 0,
        total_guests: stats?.total_guests || 0
      };
    },

    findByPhone(eventId, phone) {
      return db.get<RsvpRow>(
        'SELECT * FROM rsvp WHERE event_id = ? AND phone = ?',
        [eventId, phone]
      );
    },

    findSummaryByPhone(eventId, phone) {
      return db.get<RsvpSummary>(
        `SELECT ${SUMMARY_COLUMNS} FROM rsvp
         WHERE event_id = ? AND phone = ? ORDER BY created_at DESC LIMIT 1`,
        [eventId, phone]
      );
    },

    findSummaryById(eventId, rsvpId) {
      return db.get<RsvpSummary>(
        `SELECT ${SUMMARY_COLUMNS} FROM rsvp WHERE id = ? AND event_id = ?`,
        [rsvpId, eventId]
      );
    },

    phoneTaken(eventId, phone, exceptRsvpId) {
      const row = db.get<{ id: number }>(
        'SELECT id FROM rsvp WHERE event_id = ? AND phone = ?',
        [eventId, phone]
      );
      return !!row && row.id !== exceptRsvpId;
    },

    insert(eventId, record) {
      const result = db.run(`
        INSERT INTO rsvp (event_id, attending, name, email, phone, guests, dietary_restrictions, message, share_response, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [eventId, ...writeValues(record), record.ip_address ?? null]);
      return Number(result.lastID);
    },

    update(eventId, rsvpId, record) {
      return db.run(`
        UPDATE rsvp
        SET attending = ?, name = ?, email = ?, phone = ?, guests = ?,
            dietary_restrictions = ?, message = ?, share_response = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND event_id = ?
      `, [...writeValues(record), rsvpId, eventId]).changes;
    },

    // The guest path already resolved the row by (event, phone) and never moves
    // a response onto another number, so the phone column is left alone and the
    // submitting client's ip is refreshed.
    updateById(rsvpId, record) {
      return db.run(`
        UPDATE rsvp
        SET attending = ?, name = ?, email = ?, guests = ?, dietary_restrictions = ?,
            message = ?, share_response = ?, ip_address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        record.attending, record.name, record.email, record.guests,
        record.dietary_restrictions, record.message, record.share_response,
        record.ip_address ?? null, rsvpId
      ]).changes;
    },

    deleteById(eventId, rsvpId) {
      return db.run('DELETE FROM rsvp WHERE id = ? AND event_id = ?', [rsvpId, eventId]).changes;
    },

    sharedParticipants(eventId) {
      return db.all<SharedParticipant>(
        `SELECT name, guests FROM rsvp
         WHERE event_id = ? AND attending = 'yes' AND share_response = 1
         ORDER BY name COLLATE NOCASE ASC, id ASC`,
        [eventId]
      );
    }
  };
}
