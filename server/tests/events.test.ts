import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.ts';
import { createAuth, migrateAuth, seedAdminUser } from '../src/auth.ts';
import { openDb, initSchema, type Db } from '../src/db.ts';

// Shared signing config so every Better Auth instance uses the same secret.
process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnop';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

const ADMIN = { email: 'admin@example.com', password: 'secret-password' };
const ORIGIN = 'http://localhost:3000';

async function adminLogin(app: Express): Promise<string> {
    const res = await request(app)
        .post('/api/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .send(ADMIN)
        .expect(200);
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    return (raw ?? []).map((c) => c.split(';')[0]).join('; ');
}

const validRsvp = (overrides: Record<string, unknown> = {}) => ({
    attending: 'yes',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    guests: 2,
    ...overrides
});

describe('Events API', () => {
    let app: ReturnType<typeof createApp>;
    let db: Db;
    let authCookie: string;

    beforeEach(async () => {
        db = await openDb(':memory:');
        await initSchema(db);
        const auth = createAuth(db.raw);
        await migrateAuth(auth);
        await seedAdminUser(auth, ADMIN.email, ADMIN.password);
        app = createApp(db, {
            auth,
            rateLimits: { globalMax: 10000, rsvpMax: 10000, lookupMax: 10000, adminMax: 10000 }
        });
        authCookie = await adminLogin(app);
    });

    // Helper: create an event and return its full row.
    async function createEvent(body: Record<string, unknown>) {
        const res = await request(app)
            .post('/api/events')
            .set('Cookie', authCookie)
            .send(body)
            .expect(201);
        return res.body;
    }

    describe('Migration / default event', () => {
        it('creates a default event resolvable by the legacy settings route', async () => {
            const res = await request(app).get('/api/settings').expect(200);
            expect(res.body).toMatchObject({ theme: 'fiesta' });
        });

        it('GET /api/events/default returns the default event after updating it', async () => {
            // Find the default event id from the admin list.
            const list = await request(app).get('/api/events').set('Cookie', authCookie).expect(200);
            const def = list.body.events.find((e: { is_default: number }) => e.is_default === 1);
            await request(app)
                .put(`/api/events/${def.id}`)
                .set('Cookie', authCookie)
                .send({ person: 'Léo', date: '2025-09-06' })
                .expect(200);

            const res = await request(app).get('/api/events/default').expect(200);
            expect(res.body).toMatchObject({ slug: 'default', person: 'Léo', date: '2025-09-06' });
            // Internal fields are not exposed.
            expect(res.body.id).toBeUndefined();
            expect(res.body.is_default).toBeUndefined();
        });
    });

    describe('POST /api/events (admin create)', () => {
        it('requires authentication', async () => {
            await request(app).post('/api/events').send({ person: 'Alice' }).expect(401);
        });

        it('creates an event with an auto slug from the person', async () => {
            const created = await createEvent({ person: 'Émile Dupont', theme: 'dino' });
            expect(created).toMatchObject({ person: 'Émile Dupont', slug: 'emile-dupont', theme: 'dino' });
            expect(created.id).toEqual(expect.any(Number));

            const list = await request(app).get('/api/events').set('Cookie', authCookie).expect(200);
            const item = list.body.events.find((e: { slug: string }) => e.slug === 'emile-dupont');
            expect(item).toMatchObject({
                responses: 0, confirmations: 0, declined: 0, total_guests: 0
            });
        });

        it('rejects a missing person name', async () => {
            const res = await request(app)
                .post('/api/events')
                .set('Cookie', authCookie)
                .send({ person: '   ' })
                .expect(400);
            expect(res.body.error).toMatch(/nom est requis/);
        });
    });

    describe('Slug uniqueness', () => {
        it('gives two events with the same person distinct slugs', async () => {
            const a = await createEvent({ person: 'Marie' });
            const b = await createEvent({ person: 'Marie' });
            expect(a.slug).toBe('marie');
            expect(b.slug).toBe('marie-2');
        });

        it('rejects an explicit duplicate slug with 409', async () => {
            await createEvent({ person: 'Paul', slug: 'fete-paul' });
            const res = await request(app)
                .post('/api/events')
                .set('Cookie', authCookie)
                .send({ person: 'Other', slug: 'fete-paul' })
                .expect(409);
            expect(res.body.error).toMatch(/déjà utilisé/);
        });
    });

    describe('PUT /api/events/:id', () => {
        it('updates fields and theme', async () => {
            const created = await createEvent({ person: 'Nina' });
            const res = await request(app)
                .put(`/api/events/${created.id}`)
                .set('Cookie', authCookie)
                .send({ town: 'Lyon', theme: 'space' })
                .expect(200);
            expect(res.body).toMatchObject({ town: 'Lyon', theme: 'space', person: 'Nina' });
        });

        it('rejects an invalid theme with 400', async () => {
            const created = await createEvent({ person: 'Nina' });
            const res = await request(app)
                .put(`/api/events/${created.id}`)
                .set('Cookie', authCookie)
                .send({ theme: 'not-a-theme' })
                .expect(400);
            expect(res.body.error).toMatch(/Thème inconnu/);
        });

        it('404s for an unknown event id', async () => {
            await request(app)
                .put('/api/events/9999')
                .set('Cookie', authCookie)
                .send({ person: 'X' })
                .expect(404);
        });
    });

    describe('DELETE /api/events/:id', () => {
        it('deletes a non-default event and cascades its rsvps', async () => {
            const created = await createEvent({ person: 'Zoe' });
            await request(app)
                .post(`/api/events/${created.slug}/rsvp`)
                .send(validRsvp({ phone: '+5550001' }))
                .expect(201);

            await request(app)
                .delete(`/api/events/${created.id}`)
                .set('Cookie', authCookie)
                .expect(200);

            // The event is gone…
            await request(app).get(`/api/events/${created.slug}`).expect(404);
            // …and its rsvp cascaded away (the row no longer exists for that event).
            await request(app)
                .get(`/api/events/${created.id}/rsvps`)
                .set('Cookie', authCookie)
                .expect(404);
        });

        it('refuses to delete the default event', async () => {
            const list = await request(app).get('/api/events').set('Cookie', authCookie).expect(200);
            const def = list.body.events.find((e: { is_default: number }) => e.is_default === 1);
            const res = await request(app)
                .delete(`/api/events/${def.id}`)
                .set('Cookie', authCookie)
                .expect(400);
            expect(res.body.error).toMatch(/par défaut/);
        });
    });

    describe('Event-scoped RSVPs', () => {
        it('stores an rsvp scoped to a single event', async () => {
            const ev = await createEvent({ person: 'Hugo' });
            await request(app)
                .post(`/api/events/${ev.slug}/rsvp`)
                .send(validRsvp({ name: 'Guest A', phone: '+6660001' }))
                .expect(201);

            const res = await request(app)
                .get(`/api/events/${ev.id}/rsvps`)
                .set('Cookie', authCookie)
                .expect(200);
            expect(res.body.rsvps).toHaveLength(1);
            expect(res.body.rsvps[0]).toMatchObject({ name: 'Guest A' });
        });

        it('lets the SAME phone RSVP to two different events', async () => {
            const a = await createEvent({ person: 'Anna' });
            const b = await createEvent({ person: 'Bruno' });
            const phone = '+7770001';

            await request(app).post(`/api/events/${a.slug}/rsvp`).send(validRsvp({ phone })).expect(201);
            await request(app).post(`/api/events/${b.slug}/rsvp`).send(validRsvp({ phone })).expect(201);

            const listA = await request(app).get(`/api/events/${a.id}/rsvps`).set('Cookie', authCookie).expect(200);
            const listB = await request(app).get(`/api/events/${b.id}/rsvps`).set('Cookie', authCookie).expect(200);
            expect(listA.body.rsvps).toHaveLength(1);
            expect(listB.body.rsvps).toHaveLength(1);
        });

        it('updates an existing rsvp on re-submit (same phone, same event)', async () => {
            const ev = await createEvent({ person: 'Iris' });
            const first = await request(app)
                .post(`/api/events/${ev.slug}/rsvp`)
                .send(validRsvp({ phone: '+8880001', guests: 2 }))
                .expect(201);
            const update = await request(app)
                .post(`/api/events/${ev.slug}/rsvp`)
                .send(validRsvp({ phone: '+8880001', guests: 4 }))
                .expect(200);
            expect(update.body.id).toBe(first.body.id);
        });

        it('looks up an event-scoped rsvp by phone', async () => {
            const ev = await createEvent({ person: 'Jade' });
            await request(app)
                .post(`/api/events/${ev.slug}/rsvp`)
                .send(validRsvp({ name: 'Looked Up', phone: '+9990001' }))
                .expect(201);
            const res = await request(app)
                .get(`/api/events/${ev.slug}/rsvp/lookup/+9990001`)
                .expect(200);
            expect(res.body).toMatchObject({ name: 'Looked Up', phone: '+9990001' });
        });

        it('reports scoped counts and exports scoped CSV', async () => {
            const ev = await createEvent({ person: 'Karl' });
            await request(app).post(`/api/events/${ev.slug}/rsvp`).send(validRsvp({ phone: '+1110001', guests: 2 })).expect(201);
            await request(app).post(`/api/events/${ev.slug}/rsvp`).send(validRsvp({ phone: '+1110002', attending: 'no' })).expect(201);

            const count = await request(app).get(`/api/events/${ev.id}/rsvps/count`).set('Cookie', authCookie).expect(200);
            expect(count.body).toMatchObject({ total_responses: 2, confirmations: 1, declined: 1, total_guests: 2 });

            const csv = await request(app).get(`/api/events/${ev.id}/rsvps/export.csv`).set('Cookie', authCookie).expect(200);
            expect(csv.headers['content-disposition']).toMatch(/rsvps-karl\.csv/);
            expect(csv.text.charCodeAt(0)).toBe(0xfeff);
        });

        it('rejects a manual duplicate within the same event (409)', async () => {
            const ev = await createEvent({ person: 'Lola' });
            await request(app)
                .post(`/api/events/${ev.id}/rsvps`)
                .set('Cookie', authCookie)
                .send(validRsvp({ phone: '+1220001' }))
                .expect(201);
            await request(app)
                .post(`/api/events/${ev.id}/rsvps`)
                .set('Cookie', authCookie)
                .send(validRsvp({ phone: '+1220001' }))
                .expect(409);
        });

        it('edits and deletes an rsvp only within its event', async () => {
            const ev = await createEvent({ person: 'Milo' });
            const created = await request(app)
                .post(`/api/events/${ev.id}/rsvps`)
                .set('Cookie', authCookie)
                .send(validRsvp({ phone: '+1330001' }))
                .expect(201);

            await request(app)
                .put(`/api/events/${ev.id}/rsvp/${created.body.id}`)
                .set('Cookie', authCookie)
                .send(validRsvp({ name: 'Edited', phone: '+1330001' }))
                .expect(200);

            // Wrong event id can't touch it.
            const other = await createEvent({ person: 'Nora' });
            await request(app)
                .put(`/api/events/${other.id}/rsvp/${created.body.id}`)
                .set('Cookie', authCookie)
                .send(validRsvp({ name: 'Nope', phone: '+1330001' }))
                .expect(404);

            await request(app)
                .delete(`/api/events/${ev.id}/rsvp/${created.body.id}`)
                .set('Cookie', authCookie)
                .expect(200);
        });
    });

    describe('Public event route', () => {
        it('404s for an unknown slug', async () => {
            const res = await request(app).get('/api/events/does-not-exist').expect(404);
            expect(res.body.error).toMatch(/introuvable/);
        });

        it('returns a VCALENDAR for an event with a date', async () => {
            const ev = await createEvent({ person: 'Olga', date: '2025-09-06', time: '15h00 - 17h00' });
            const res = await request(app).get(`/api/events/${ev.slug}/event.ics`).expect(200);
            expect(res.headers['content-type']).toMatch(/text\/calendar/);
            expect(res.text).toContain('BEGIN:VCALENDAR');
            expect(res.text).toContain('SUMMARY:Anniversaire de Olga');
        });

        it('404s the ics for an event with no date', async () => {
            const ev = await createEvent({ person: 'Pia' });
            await request(app).get(`/api/events/${ev.slug}/event.ics`).expect(404);
        });
    });

    describe('RSVP deadline (event-scoped)', () => {
        it('reports rsvp_closed and 403s on submit when the deadline has passed', async () => {
            const ev = await createEvent({ person: 'Remy', date: '2999-01-01', rsvp_deadline: '2000-01-01' });
            const get = await request(app).get(`/api/events/${ev.slug}`).expect(200);
            expect(get.body.rsvp_closed).toBe(true);

            const res = await request(app)
                .post(`/api/events/${ev.slug}/rsvp`)
                .send(validRsvp({ phone: '+1440001' }))
                .expect(403);
            expect(res.body.error).toMatch(/closes/);
        });

        it('reports rsvp_closed false when no deadline', async () => {
            const ev = await createEvent({ person: 'Sami' });
            const get = await request(app).get(`/api/events/${ev.slug}`).expect(200);
            expect(get.body.rsvp_closed).toBe(false);
        });
    });
});
