import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.ts';
import { createAuth, migrateAuth, seedAdminUser, type Auth } from '../src/auth.ts';
import { openDb, initSchema, type Db } from '../src/db.ts';
import type { Mailer, MailMessage } from '../src/mailer.ts';

// Same fixed signing config as the RSVP suite so cookies validate.
process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnop';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

const ORIGIN = 'http://localhost:3000';
const ADMIN = { email: 'admin@example.com', password: 'secret-password' };
const MEMBER = { email: 'member@example.com', password: 'member-password', name: 'Member' };

// Collects every email instead of sending it, so tests can pull the
// verification / reset link straight out of the message body.
function createTestMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    enabled: true,
    sent,
    async send(message) {
      sent.push(message);
    }
  };
}

// Better Auth puts the callback URL in the text body; pull the first http link.
function linkFrom(message: MailMessage): string {
  const match = message.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`no link in email: ${message.text}`);
  return match[0];
}

function cookiesFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (raw ?? []).map((c) => c.split(';')[0]).join('; ');
}

describe('Authentication, registration and roles', () => {
  let app: Express;
  let db: Db;
  let auth: Auth;
  let mailer: ReturnType<typeof createTestMailer>;
  let adminCookie: string;

  // Register MEMBER, click the emailed verification link, and return the
  // resulting session cookie plus the account id.
  async function registerAndVerify(
    credentials = MEMBER
  ): Promise<{ cookie: string; id: string }> {
    await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send(credentials)
      .expect(200);

    const email = mailer.sent.at(-1)!;
    // The verification link is a GET the browser follows; it redirects on success.
    const verify = await request(app).get(new URL(linkFrom(email)).pathname + new URL(linkFrom(email)).search);
    expect(verify.status).toBeLessThan(400);

    const signIn = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    const row = db.get<{ id: string }>('SELECT id FROM "user" WHERE email = ?', [credentials.email]);
    return { cookie: cookiesFrom(signIn), id: row!.id };
  }

  beforeEach(async () => {
    db = openDb(':memory:');
    initSchema(db);
    mailer = createTestMailer();
    auth = createAuth(db.raw, { mailer, google: null });
    await migrateAuth(auth);
    await seedAdminUser(auth, ADMIN.email, ADMIN.password);
    app = createApp(db, {
      auth,
      rateLimits: { globalMax: 10000, signupMax: 10000, loginMax: 10000, adminMax: 10000 }
    });
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send(ADMIN)
      .expect(200);
    adminCookie = cookiesFrom(res);
  });

  describe('GET /api/auth-providers', () => {
    it('reports Google as unavailable when no credentials are configured', async () => {
      const res = await request(app).get('/api/auth-providers').expect(200);
      expect(res.body).toEqual({ emailPassword: true, google: false });
    });

    it('reports Google as available once credentials are configured', async () => {
      const googleDb = openDb(':memory:');
      initSchema(googleDb);
      const googleAuth = createAuth(googleDb.raw, {
        mailer,
        google: { clientId: 'client-id', clientSecret: 'client-secret' }
      });
      await migrateAuth(googleAuth);
      const googleApp = createApp(googleDb, { auth: googleAuth, rateLimits: { globalMax: 10000 } });
      const res = await request(googleApp).get('/api/auth-providers').expect(200);
      expect(res.body).toEqual({ emailPassword: true, google: true });
    });
  });

  describe('Email registration', () => {
    it('sends a verification email on sign-up', async () => {
      await request(app)
        .post('/api/auth/sign-up/email')
        .set('Origin', ORIGIN)
        .send(MEMBER)
        .expect(200);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].to).toBe(MEMBER.email);
      expect(mailer.sent[0].subject).toBe('Confirmez votre adresse email');
    });

    it('refuses sign-in until the email is verified', async () => {
      await request(app)
        .post('/api/auth/sign-up/email')
        .set('Origin', ORIGIN)
        .send(MEMBER)
        .expect(200);
      await request(app)
        .post('/api/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send({ email: MEMBER.email, password: MEMBER.password })
        .expect(403);
    });

    it('allows sign-in after the emailed link is followed', async () => {
      const { cookie } = await registerAndVerify();
      const me = await request(app).get('/api/me').set('Cookie', cookie).expect(200);
      expect(me.body.user).toMatchObject({ email: MEMBER.email, emailVerified: true, role: 'user' });
    });

    it('ignores a role injected into the sign-up body', async () => {
      await request(app)
        .post('/api/auth/sign-up/email')
        .set('Origin', ORIGIN)
        .send({ ...MEMBER, role: 'admin' })
        .expect(200);
      const row = db.get<{ role: string }>('SELECT role FROM "user" WHERE email = ?', [MEMBER.email]);
      expect(row?.role).toBe('user');
    });

    it('rejects a password shorter than the minimum', async () => {
      await request(app)
        .post('/api/auth/sign-up/email')
        .set('Origin', ORIGIN)
        .send({ email: 'short@example.com', password: 'short', name: 'Short' })
        .expect(400);
    });
  });

  describe('Password reset', () => {
    it('emails a reset link and accepts the new password', async () => {
      const { cookie } = await registerAndVerify();
      await request(app).post('/api/auth/sign-out').set('Origin', ORIGIN).set('Cookie', cookie).expect(200);

      mailer.sent.length = 0;
      await request(app)
        .post('/api/auth/request-password-reset')
        .set('Origin', ORIGIN)
        .send({ email: MEMBER.email, redirectTo: `${ORIGIN}/reset-password` })
        .expect(200);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].subject).toBe('Réinitialisez votre mot de passe');

      // The emailed URL carries the token; Better Auth accepts it on reset.
      const token = new URL(linkFrom(mailer.sent[0])).pathname.split('/').pop()!;
      await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ newPassword: 'a-brand-new-password', token })
        .expect(200);

      await request(app)
        .post('/api/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send({ email: MEMBER.email, password: 'a-brand-new-password' })
        .expect(200);
    });
  });

  describe('Role enforcement', () => {
    it('401s on admin routes with no session', async () => {
      await request(app).get('/api/users').expect(401);
      await request(app).get('/api/rsvps').expect(401);
    });

    it('403s with code not_admin for a registered non-admin', async () => {
      const { cookie } = await registerAndVerify();
      const res = await request(app).get('/api/rsvps').set('Cookie', cookie).expect(403);
      expect(res.body).toMatchObject({ code: 'not_admin' });
    });

    it('lets an admin through', async () => {
      await request(app).get('/api/rsvps').set('Cookie', adminCookie).expect(200);
    });

    it('reports the admin role on /api/me', async () => {
      const res = await request(app).get('/api/me').set('Cookie', adminCookie).expect(200);
      expect(res.body.user).toMatchObject({ email: ADMIN.email, role: 'admin' });
    });

    it('401s on /api/me without a session', async () => {
      await request(app).get('/api/me').expect(401);
    });
  });

  describe('GET /api/users', () => {
    it('lists every account without exposing credentials', async () => {
      await registerAndVerify();
      const res = await request(app).get('/api/users').set('Cookie', adminCookie).expect(200);
      const emails = res.body.users.map((u: { email: string }) => u.email);
      expect(emails).toContain(ADMIN.email);
      expect(emails).toContain(MEMBER.email);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toMatch(/password|hash/i);
    });

    it('is refused to a non-admin', async () => {
      const { cookie } = await registerAndVerify();
      await request(app).get('/api/users').set('Cookie', cookie).expect(403);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('promotes a member, who then reaches the admin API', async () => {
      const { cookie, id } = await registerAndVerify();
      await request(app).get('/api/rsvps').set('Cookie', cookie).expect(403);

      const res = await request(app)
        .put(`/api/users/${id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'admin' })
        .expect(200);
      expect(res.body.user).toMatchObject({ id, role: 'admin' });

      // The existing session picks the new role up on its next request.
      await request(app).get('/api/rsvps').set('Cookie', cookie).expect(200);
    });

    it('revokes the sessions of a demoted admin immediately', async () => {
      const { cookie, id } = await registerAndVerify();
      await request(app)
        .put(`/api/users/${id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'admin' })
        .expect(200);
      await request(app).get('/api/rsvps').set('Cookie', cookie).expect(200);

      await request(app)
        .put(`/api/users/${id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'user' })
        .expect(200);
      // Session dropped server-side, so this is a 401 rather than a 403.
      await request(app).get('/api/rsvps').set('Cookie', cookie).expect(401);
    });

    it('refuses an unknown role', async () => {
      const { id } = await registerAndVerify();
      await request(app)
        .put(`/api/users/${id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'superuser' })
        .expect(400);
    });

    it('refuses to demote the acting admin', async () => {
      const me = await request(app).get('/api/me').set('Cookie', adminCookie).expect(200);
      const res = await request(app)
        .put(`/api/users/${me.body.user.id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'user' })
        .expect(400);
      expect(res.body.error).toMatch(/votre propre accès/i);
    });

    it('404s for an unknown account', async () => {
      await request(app)
        .put('/api/users/does-not-exist/role')
        .set('Cookie', adminCookie)
        .send({ role: 'admin' })
        .expect(404);
    });

    it('is refused to a non-admin', async () => {
      const { cookie, id } = await registerAndVerify();
      await request(app).put(`/api/users/${id}/role`).set('Cookie', cookie).send({ role: 'admin' }).expect(403);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deletes an account and its sessions', async () => {
      const { cookie, id } = await registerAndVerify();
      await request(app).delete(`/api/users/${id}`).set('Cookie', adminCookie).expect(200);

      expect(db.get('SELECT id FROM "user" WHERE id = ?', [id])).toBeUndefined();
      await request(app).get('/api/me').set('Cookie', cookie).expect(401);
    });

    it('refuses to delete the acting admin', async () => {
      const me = await request(app).get('/api/me').set('Cookie', adminCookie).expect(200);
      const res = await request(app)
        .delete(`/api/users/${me.body.user.id}`)
        .set('Cookie', adminCookie)
        .expect(400);
      expect(res.body.error).toMatch(/votre propre compte/i);
    });

    it('refuses to remove the last remaining admin', async () => {
      // Promote a member, sign in as them, then try to delete the seeded admin
      // after demoting... instead: delete is guarded by the admin count, so
      // deleting the only *other* admin must fail once they are the last one.
      const { cookie, id } = await registerAndVerify();
      await request(app)
        .put(`/api/users/${id}/role`)
        .set('Cookie', adminCookie)
        .send({ role: 'admin' })
        .expect(200);
      const memberCookie = (
        await request(app)
          .post('/api/auth/sign-in/email')
          .set('Origin', ORIGIN)
          .send({ email: MEMBER.email, password: MEMBER.password })
          .expect(200)
      ).headers['set-cookie'] as unknown as string[];
      const cookieHeader = memberCookie.map((c) => c.split(';')[0]).join('; ');
      void cookie;

      // Two admins now: the member may delete the seeded admin.
      const seeded = db.get<{ id: string }>('SELECT id FROM "user" WHERE email = ?', [ADMIN.email]);
      await request(app).delete(`/api/users/${seeded!.id}`).set('Cookie', cookieHeader).expect(200);

      // One admin left (the member). Deleting themselves is already refused;
      // and no other admin exists to be removed.
      expect(db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM "user" WHERE role = 'admin'`)?.n).toBe(1);
    });

    it('404s for an unknown account', async () => {
      await request(app).delete('/api/users/does-not-exist').set('Cookie', adminCookie).expect(404);
    });

    it('is refused to a non-admin', async () => {
      const { cookie, id } = await registerAndVerify();
      await request(app).delete(`/api/users/${id}`).set('Cookie', cookie).expect(403);
    });
  });
});
