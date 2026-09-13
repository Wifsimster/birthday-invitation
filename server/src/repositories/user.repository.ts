// Read access to Better Auth's `user` and `session` tables.
//
// Better Auth owns writing those tables (through its internal adapter), so this
// repository deliberately only reads them — plus the one write the app does on
// its own behalf: dropping a demoted account's sessions.

import type { Db } from '../db.ts';
import type { UserRepository, UserRow } from './types.ts';

// Password hashes live in the `account` table and are never selected here.
const USER_COLUMNS = 'id, name, email, emailVerified, image, role, "createdAt"';

export function createUserRepository(db: Db): UserRepository {
  return {
    list() {
      return db.all<UserRow>(
        `SELECT ${USER_COLUMNS} FROM "user" ORDER BY "createdAt" DESC, id DESC`
      );
    },

    findById(id) {
      return db.get<UserRow>(`SELECT ${USER_COLUMNS} FROM "user" WHERE id = ?`, [id]);
    },

    countAdmins() {
      return db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM "user" WHERE role = 'admin'`)?.n ?? 0;
    },

    deleteSessions(userId) {
      return db.run(`DELETE FROM "session" WHERE "userId" = ?`, [userId]).changes;
    }
  };
}
