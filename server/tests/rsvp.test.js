import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb, initSchema } from '../src/db.js';

const ADMIN = { username: 'admin', password: 'secret' };
const authHeader = 'Basic ' + Buffer.from(`${ADMIN.username}:${ADMIN.password}`).toString('base64');

// A complete, valid RSVP payload. Tests override individual fields as needed.
const validRsvp = (overrides = {}) => ({
    attending: 'yes',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    guests: 2,
    ...overrides
});

describe('RSVP API', () => {
    let app;
    let db;

    beforeEach(async () => {
        // A fresh in-memory database per test, wired to the *real* app factory.
        db = await openDb(':memory:');
        await initSchema(db);
        app = createApp(db, {
            adminUsername: ADMIN.username,
            adminPassword: ADMIN.password,
            // Generous limits so tests don't trip the rate limiter.
            rateLimits: { globalMax: 10000, rsvpMax: 10000 }
        });
    });

    describe('POST /api/rsvp', () => {
        it('accepts a valid RSVP', async () => {
            const res = await request(app).post('/api/rsvp').send(validRsvp()).expect(201);
            expect(res.body).toMatchObject({
                message: 'Réponse soumise avec succès !',
                id: expect.any(Number)
            });
        });

        it('rejects a missing name', async () => {
            const res = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ name: undefined }))
                .expect(400);
            expect(res.body).toMatchObject({ error: 'Le nom est requis' });
        });

        it('rejects an empty name', async () => {
            const res = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ name: '   ' }))
                .expect(400);
            expect(res.body).toMatchObject({ error: 'Le nom est requis' });
        });

        it('rejects a missing phone', async () => {
            const res = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ phone: undefined }))
                .expect(400);
            expect(res.body).toMatchObject({ error: 'Le numéro de téléphone est requis' });
        });

        it('rejects a missing/invalid attending status', async () => {
            const res = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ attending: 'maybe' }))
                .expect(400);
            expect(res.body).toMatchObject({ error: 'Le statut de participation est requis' });
        });

        it('rejects a guest count that is too low', async () => {
            const res = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ guests: 0 }))
                .expect(400);
            expect(res.body.error).toMatch(/nombre d'invités/);
        });

        it('rejects a guest count that is too high', async () => {
            const res = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ guests: 15 }))
                .expect(400);
            expect(res.body.error).toMatch(/nombre d'invités/);
        });

        it('accepts guest counts within range', async () => {
            for (const guests of [1, 5, 10]) {
                await request(app)
                    .post('/api/rsvp')
                    .send(validRsvp({ guests, phone: `+100000000${guests}` }))
                    .expect(201);
            }
        });

        it('trims whitespace from name and email', async () => {
            await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ name: '  John Doe  ', email: '  john@example.com  ' }))
                .expect(201);

            const res = await request(app).get('/api/rsvps').set('Authorization', authHeader).expect(200);
            expect(res.body.rsvps[0]).toMatchObject({ name: 'John Doe', email: 'john@example.com' });
        });

        it('records 0 guests when declining', async () => {
            await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ attending: 'no', guests: 3 }))
                .expect(201);

            const res = await request(app).get('/api/rsvps').set('Authorization', authHeader).expect(200);
            expect(res.body.rsvps[0].guests).toBe(0);
        });

        it('updates the existing RSVP when the same phone re-submits', async () => {
            const first = await request(app).post('/api/rsvp').send(validRsvp({ guests: 2 })).expect(201);

            const update = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ guests: 4, message: 'changed' }))
                .expect(200);

            expect(update.body).toMatchObject({
                message: 'Réponse mise à jour avec succès !',
                id: first.body.id
            });

            const res = await request(app).get('/api/rsvps').set('Authorization', authHeader).expect(200);
            expect(res.body.rsvps).toHaveLength(1);
            expect(res.body.rsvps[0]).toMatchObject({ guests: 4, message: 'changed' });
        });
    });

    describe('GET /api/rsvps (admin)', () => {
        it('requires authentication', async () => {
            await request(app).get('/api/rsvps').expect(401);
        });

        it('returns an empty array when no RSVPs exist', async () => {
            const res = await request(app).get('/api/rsvps').set('Authorization', authHeader).expect(200);
            expect(res.body).toMatchObject({ rsvps: [] });
        });

        it('returns all RSVPs, newest first', async () => {
            const people = ['First', 'Second', 'Third'];
            for (let i = 0; i < people.length; i++) {
                await request(app)
                    .post('/api/rsvp')
                    .send(validRsvp({ name: people[i], phone: `+2000000000${i}` }));
                await new Promise((r) => setTimeout(r, 10));
            }

            const res = await request(app).get('/api/rsvps').set('Authorization', authHeader).expect(200);
            expect(res.body.rsvps.map((r) => r.name)).toEqual(['Third', 'Second', 'First']);
        });
    });

    describe('GET /api/rsvps/count (admin)', () => {
        it('requires authentication', async () => {
            await request(app).get('/api/rsvps/count').expect(401);
        });

        it('returns zero counts when empty', async () => {
            const res = await request(app).get('/api/rsvps/count').set('Authorization', authHeader).expect(200);
            expect(res.body).toMatchObject({ total_responses: 0, confirmations: 0, declined: 0, total_guests: 0 });
        });

        it('aggregates confirmations, declines and guests', async () => {
            await request(app).post('/api/rsvp').send(validRsvp({ phone: '+30000001', guests: 2 }));
            await request(app).post('/api/rsvp').send(validRsvp({ phone: '+30000002', guests: 3 }));
            await request(app).post('/api/rsvp').send(validRsvp({ phone: '+30000003', attending: 'no' }));

            const res = await request(app).get('/api/rsvps/count').set('Authorization', authHeader).expect(200);
            expect(res.body).toMatchObject({
                total_responses: 3,
                confirmations: 2,
                declined: 1,
                total_guests: 5
            });
        });
    });

    describe('GET /api/rsvp/lookup/:phone', () => {
        it('returns the RSVP for a known phone', async () => {
            await request(app).post('/api/rsvp').send(validRsvp({ phone: '+40000001' }));
            const res = await request(app).get('/api/rsvp/lookup/+40000001').expect(200);
            expect(res.body).toMatchObject({ name: 'John Doe', phone: '+40000001' });
        });

        it('returns 404 for an unknown phone', async () => {
            await request(app).get('/api/rsvp/lookup/+99999999').expect(404);
        });
    });

    describe('Phone normalisation', () => {
        it('matches a re-submission with different spacing as the same guest', async () => {
            const first = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ phone: '06 12 34 56 78', guests: 2 }))
                .expect(201);

            const second = await request(app)
                .post('/api/rsvp')
                .send(validRsvp({ phone: '06-12-34.56.78', guests: 5 }))
                .expect(200);

            expect(second.body.id).toBe(first.body.id);

            const res = await request(app).get('/api/rsvps').set('Authorization', authHeader).expect(200);
            expect(res.body.rsvps).toHaveLength(1);
            expect(res.body.rsvps[0].phone).toBe('0612345678');
        });

        it('looks up a guest regardless of how the phone is formatted', async () => {
            await request(app).post('/api/rsvp').send(validRsvp({ phone: '06 12 34 56 78' })).expect(201);
            const res = await request(app).get('/api/rsvp/lookup/0612345678').expect(200);
            expect(res.body.name).toBe('John Doe');
        });

        it('rejects a phone with no digits', async () => {
            await request(app).post('/api/rsvp').send(validRsvp({ phone: '----' })).expect(400);
        });
    });

    describe('GET /api/rsvps/export.csv (admin)', () => {
        it('requires authentication', async () => {
            await request(app).get('/api/rsvps/export.csv').expect(401);
        });

        it('exports rows as CSV with a header and BOM', async () => {
            await request(app).post('/api/rsvp').send(validRsvp({ name: 'Alice', phone: '+33100000001' }));
            await request(app).post('/api/rsvp').send(validRsvp({ name: 'Bob', phone: '+33100000002', message: 'a, b "c"' }));

            const res = await request(app)
                .get('/api/rsvps/export.csv')
                .set('Authorization', authHeader)
                .expect(200);

            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.headers['content-disposition']).toMatch(/rsvps\.csv/);
            expect(res.text.charCodeAt(0)).toBe(0xfeff); // BOM
            const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
            expect(lines[0]).toBe('id,name,attending,email,phone,guests,message,created_at,updated_at');
            expect(lines).toHaveLength(3);
            // The quote/comma-bearing message must be RFC 4180 escaped.
            expect(res.text).toContain('"a, b ""c"""');
        });
    });

    describe('GET /api/event.ics', () => {
        it('returns a calendar invite built from the event config', async () => {
            const withEvent = createApp(db, {
                adminUsername: ADMIN.username,
                adminPassword: ADMIN.password,
                event: { person: 'Léo', age: '5', date: '2025-09-06', time: '15h00 - 17h00', location: 'Chez Léo' }
            });

            const res = await request(withEvent).get('/api/event.ics').expect(200);
            expect(res.headers['content-type']).toMatch(/text\/calendar/);
            expect(res.text).toContain('BEGIN:VCALENDAR');
            expect(res.text).toContain('SUMMARY:Anniversaire de Léo (5 ans)');
            expect(res.text).toContain('DTSTART:20250906T150000');
            expect(res.text).toContain('DTEND:20250906T170000');
            expect(res.text).toContain('LOCATION:Chez Léo');
        });

        it('returns 404 when no event date is configured', async () => {
            const noEvent = createApp(db, { event: { person: 'X', date: '' } });
            await request(noEvent).get('/api/event.ics').expect(404);
        });
    });

    describe('Static SPA serving', () => {
        let staticDir;
        let staticApp;

        beforeEach(() => {
            staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-'));
            fs.mkdirSync(path.join(staticDir, 'assets'));
            fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><div id=app></div>');
            fs.writeFileSync(path.join(staticDir, 'assets', 'index-abc12345.js'), 'console.log(1)');
            staticApp = createApp(db, {
                adminUsername: ADMIN.username,
                adminPassword: ADMIN.password,
                rateLimits: { globalMax: 10000, rsvpMax: 10000 },
                staticDir
            });
        });

        it('serves index.html at the root', async () => {
            const res = await request(staticApp).get('/').expect(200);
            expect(res.text).toContain('id=app');
        });

        it('falls back to index.html for SPA routes', async () => {
            const res = await request(staticApp).get('/some/client/route').expect(200);
            expect(res.text).toContain('id=app');
        });

        it('serves hashed assets with a long immutable cache', async () => {
            const res = await request(staticApp).get('/assets/index-abc12345.js').expect(200);
            expect(res.headers['cache-control']).toMatch(/immutable/);
        });

        it('still returns JSON 404 for unknown API routes (no HTML fallback)', async () => {
            const res = await request(staticApp).get('/api/does-not-exist').expect(404);
            expect(res.headers['content-type']).toMatch(/json/);
        });

        it('keeps API routes working alongside static serving', async () => {
            await request(staticApp).get('/api/health').expect(200);
        });
    });

    describe('GET /api/health', () => {
        it('reports OK with a valid timestamp', async () => {
            const res = await request(app).get('/api/health').expect(200);
            expect(res.body).toMatchObject({ status: 'OK', timestamp: expect.any(String) });
            expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
        });
    });

    describe('Error handling', () => {
        it('returns 400 for malformed JSON', async () => {
            await request(app)
                .post('/api/rsvp')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect(400);
        });

        it('returns 400 when the body is not JSON (no name parsed)', async () => {
            const res = await request(app).post('/api/rsvp').send('name=Test').expect(400);
            expect(res.body).toMatchObject({ error: 'Le nom est requis' });
        });
    });
});
