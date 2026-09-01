import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.ts';
import { createAuth, migrateAuth, seedAdminUser, type Auth } from '../src/auth.ts';
import { openDb, initSchema, type Db } from '../src/db.ts';
import type { Mailer, MailMessage } from '../src/mailer.ts';

// Same fixed signing config as the other suites so cookies validate.
process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnop';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

const ORIGIN = 'http://localhost:3000';
const ADMIN = { email: 'admin@example.com', password: 'secret-password' };
const ALICE = { email: 'alice@example.com', password: 'alice-password', name: 'Alice' };
const BOB = { email: 'bob@example.com', password: 'bob-password', name: 'Bob' };

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

function linkFrom(message: MailMessage): string {
  const match = message.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`no link in email: ${message.text}`);
  return match[0];
}

function cookiesFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (raw ?? []).map((c) => c.split(';')[0]).join('; ');
}

/**
 * Every registered account may run as many invitations as it likes. This suite
 * pins the boundary that makes that safe: an account reaches exactly the
 * invitations it created, an admin reaches all of them, and someone else's
 * invitation is indistinguishable from one that does not exist.
 */
describe('Per-account invitations', () => {
  let app: Express;
  let db: Db;
  let auth: Auth;
  let mailer: ReturnType<typeof createTestMailer>;
  let adminCookie: string;

  // Register an account, follow the emailed verification link, and sign in.
  async function register(credentials: typeof ALICE): Promise<{ cookie: string; id: string }> {
    await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send(credentials)
      .expect(200);

    const link = new URL(linkFrom(mailer.sent.at(-1)!));
    const verify = await request(app).get(link.pathname + link.search);
    expect(verify.status).toBeLessThan(400);

    const signIn = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    const row = db.get<{ id: string }>('SELECT id FROM "user" WHERE email = ?', [credentials.email]);
    return { cookie: cookiesFrom(signIn), id: row!.id };
  }

  // Create an invitation as the given account and return the stored row.
  async function createEvent(cookie: string, body: Record<string, unknown>) {
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(body).expect(201);
    return res.body;
  }

  const listIds = async (cookie: string): Promise<number[]> => {
    const res = await request(app).get('/api/events').set('Cookie', cookie).expect(200);
    return res.body.events.map((e: { id: number }) => e.id);
  };

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
    adminCookie = cookiesFrom(
      await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send(ADMIN).expect(200)
    );
  });

  describe('Creating invitations', () => {
    it('lets a registered account create several invitations of its own', async () => {
      const { cookie, id } = await register(ALICE);

      const first = await createEvent(cookie, { person: 'Léo', date: '2099-09-06' });
      const second = await createEvent(cookie, { person: 'Mila', date: '2099-10-11' });
      const third = await createEvent(cookie, { person: 'Noé' });

      expect(new Set([first.slug, second.slug, third.slug]).size).toBe(3);
      for (const ev of [first, second, third]) {
        expect(db.get<{ owner_id: string }>('SELECT owner_id FROM event WHERE id = ?', [ev.id])?.owner_id).toBe(id);
      }
      expect(await listIds(cookie)).toEqual(expect.arrayContaining([first.id, second.id, third.id]));
    });

    it('derives a unique slug across accounts celebrating the same name', async () => {
      const alice = await register(ALICE);
      const bob = await register(BOB);
      const hers = await createEvent(alice.cookie, { person: 'Léo' });
      const his = await createEvent(bob.cookie, { person: 'Léo' });
      expect(hers.slug).toBe('leo');
      expect(his.slug).toBe('leo-2');
    });

    it('refuses an unauthenticated create', async () => {
      await request(app).post('/api/events').send({ person: 'Léo' }).expect(401);
      await request(app).get('/api/events').expect(401);
    });

    it('ignores an owner injected into the request body', async () => {
      const alice = await register(ALICE);
      const bob = await register(BOB);
      const ev = await createEvent(alice.cookie, { person: 'Léo', owner_id: bob.id });
      expect(db.get<{ owner_id: string }>('SELECT owner_id FROM event WHERE id = ?', [ev.id])?.owner_id).toBe(alice.id);
    });
  });

  describe('Isolation between accounts', () => {
    it('lists only the account own invitations, not the default event', async () => {
      const alice = await register(ALICE);
      const bob = await register(BOB);
      const hers = await createEvent(alice.cookie, { person: 'Léo' });
      const his = await createEvent(bob.cookie, { person: 'Mila' });

      expect(await listIds(alice.cookie)).toEqual([hers.id]);
      expect(await listIds(bob.cookie)).toEqual([his.id]);
    });

    it("404s on every route of another account's invitation", async () => {
      const alice = await register(ALICE);
      const bob = await register(BOB);
      const hers = await createEvent(alice.cookie, { person: 'Léo' });

      await request(app).put(`/api/events/${hers.id}`).set('Cookie', bob.cookie).send({ person: 'Bob' }).expect(404);
      await request(app).delete(`/api/events/${hers.id}`).set('Cookie', bob.cookie).expect(404);
      await request(app).get(`/api/events/${hers.id}/rsvps`).set('Cookie', bob.cookie).expect(404);
      await request(app).get(`/api/events/${hers.id}/rsvps/count`).set('Cookie', bob.cookie).expect(404);
      await request(app).get(`/api/events/${hers.id}/rsvps/export.csv`).set('Cookie', bob.cookie).expect(404);
      await request(app)
        .post(`/api/events/${hers.id}/rsvps`)
        .set('Cookie', bob.cookie)
        .send({ attending: 'yes', name: 'Intrus', phone: '+1234567890' })
        .expect(404);

      // Untouched by the refused writes.
      expect(db.get<{ person: string }>('SELECT person FROM event WHERE id = ?', [hers.id])?.person).toBe('Léo');
    });

    it("keeps guest data out of another account's reach", async () => {
      const alice = await register(ALICE);
      const bob = await register(BOB);
      const hers = await createEvent(alice.cookie, { person: 'Léo' });

      await request(app)
        .post(`/api/events/${hers.slug}/rsvp`)
        .send({ attending: 'yes', name: 'Invitée', phone: '+33612345678', guests: 2 })
        .expect(201);

      const mine = await request(app).get(`/api/events/${hers.id}/rsvps`).set('Cookie', alice.cookie).expect(200);
      expect(mine.body.rsvps).toHaveLength(1);
      const rsvpId = mine.body.rsvps[0].id;

      await request(app)
        .put(`/api/events/${hers.id}/rsvp/${rsvpId}`)
        .set('Cookie', bob.cookie)
        .send({ attending: 'no', name: 'Invitée', phone: '+33612345678' })
        .expect(404);
      await request(app).delete(`/api/events/${hers.id}/rsvp/${rsvpId}`).set('Cookie', bob.cookie).expect(404);
      expect(db.get<{ attending: string }>('SELECT attending FROM rsvp WHERE id = ?', [rsvpId])?.attending).toBe('yes');
    });

    it('leaves the admin-only routes closed to a regular account', async () => {
      const { cookie } = await register(ALICE);
      await request(app).get('/api/users').set('Cookie', cookie).expect(403);
      await request(app).get('/api/rsvps').set('Cookie', cookie).expect(403);
      await request(app).put('/api/settings').set('Cookie', cookie).send({ theme: 'fiesta' }).expect(403);
    });
  });

  describe('Admin oversight', () => {
    it('sees every invitation, including the ownerless default event', async () => {
      const alice = await register(ALICE);
      const bob = await register(BOB);
      const hers = await createEvent(alice.cookie, { person: 'Léo' });
      const his = await createEvent(bob.cookie, { person: 'Mila' });

      const ids = await listIds(adminCookie);
      expect(ids).toEqual(expect.arrayContaining([hers.id, his.id]));
      const defaultRow = db.get<{ id: number }>('SELECT id FROM event WHERE is_default = 1');
      expect(ids).toContain(defaultRow!.id);
    });

    it("may edit and delete another account's invitation", async () => {
      const { cookie } = await register(ALICE);
      const first = await createEvent(cookie, { person: 'Léo' });
      const second = await createEvent(cookie, { person: 'Mila' });

      await request(app)
        .put(`/api/events/${first.id}`)
        .set('Cookie', adminCookie)
        .send({ person: 'Léo (corrigé)' })
        .expect(200);
      await request(app).delete(`/api/events/${second.id}`).set('Cookie', adminCookie).expect(200);

      expect(await listIds(cookie)).toEqual([first.id]);
    });

    it('keeps the default event off a regular account and out of its reach', async () => {
      const { cookie } = await register(ALICE);
      const defaultRow = db.get<{ id: number }>('SELECT id FROM event WHERE is_default = 1');
      await request(app).get(`/api/events/${defaultRow!.id}/rsvps`).set('Cookie', cookie).expect(404);
      await request(app)
        .put(`/api/events/${defaultRow!.id}`)
        .set('Cookie', cookie)
        .send({ person: 'Détourné' })
        .expect(404);
    });

    it("deletes an account's invitations along with the account", async () => {
      const { cookie, id } = await register(ALICE);
      const first = await createEvent(cookie, { person: 'Léo' });
      await createEvent(cookie, { person: 'Mila' });
      await request(app)
        .post(`/api/events/${first.slug}/rsvp`)
        .send({ attending: 'yes', name: 'Invitée', phone: '+33612345678' })
        .expect(201);

      await request(app).delete(`/api/users/${id}`).set('Cookie', adminCookie).expect(200);

      expect(db.all('SELECT id FROM event WHERE owner_id = ?', [id])).toHaveLength(0);
      // The invitation is gone from the public side too, and its RSVPs cascaded.
      await request(app).get(`/api/events/${first.slug}`).expect(404);
      expect(db.all('SELECT id FROM rsvp WHERE event_id = ?', [first.id])).toHaveLength(0);
    });
  });
});
