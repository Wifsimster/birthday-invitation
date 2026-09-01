import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { createAuth, migrateAuth, seedAdminUser } from '../src/auth.ts';
import { openDb, initSchema, type Db, type EventRow } from '../src/db.ts';
import { buildOgSvg, cardContent, ogImageAlt, renderOgPng, stripPictographs, OG_WIDTH, OG_HEIGHT } from '../src/og-image.ts';
import { buildEventMeta, renderIndexHtml } from '../src/seo.ts';
import { THEME_IDS } from '../src/themes.ts';

process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnop';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

const ADMIN = { email: 'admin@example.com', password: 'secret-password' };
const ORIGIN = 'http://localhost:3000';

const SHELL = `<!DOCTYPE html>
<html lang="fr"><head><title>Invitation d'anniversaire</title>
<!--seo--><meta name="description" content="default" /><!--/seo-->
</head><body><div id="app"></div></body></html>`;

const eventRow = (overrides: Partial<EventRow> = {}): EventRow => ({
    id: 1,
    slug: 'default',
    person: 'Léo',
    age: '5',
    date: '2099-09-06',
    time: '15h00 - 17h00',
    town: 'Artigues-près-Bordeaux',
    location: '🏠 Chez Léo',
    dress_code: '',
    theme: 'fiesta',
    rsvp_deadline: '',
    is_default: 1,
    owner_id: null,
    created_at: '2025-01-01 10:00:00',
    updated_at: '2025-02-03 10:00:00',
    ...overrides
});

// The 8-byte PNG signature, then the IHDR chunk carrying the dimensions.
function pngSize(buf: Buffer): { width: number; height: number } {
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('Open Graph card (unit)', () => {
    it('strips emoji, which the bundled font subset has no glyphs for', () => {
        expect(stripPictographs('🏠 Chez Léo')).toBe('Chez Léo');
        expect(stripPictographs('👨‍👩‍👧‍👦 Famille')).toBe('Famille');
        expect(stripPictographs('Salle des fêtes')).toBe('Salle des fêtes');
    });

    it('builds the card copy from the event', () => {
        const c = cardContent(eventRow());
        expect(c.heading).toBe('Anniversaire de Léo');
        expect(c.badge).toBe('5 ans');
        expect(c.when).toContain('dimanche 6 septembre 2099');
        expect(c.where).toBe('Chez Léo, Artigues-près-Bordeaux');
        expect(c.cta).toBe("Réponds à l'invitation");
    });

    it('says the responses are closed once the deadline has passed', () => {
        expect(cardContent(eventRow({ rsvp_deadline: '2020-01-01' })).cta)
            .toBe('Les réponses sont closes');
    });

    it('omits the lines an event has not filled in', () => {
        const svg = buildOgSvg(eventRow({ age: '', date: '', time: '', town: '', location: '' }));
        expect(svg).toContain('Anniversaire de Léo');
        expect(svg).not.toContain('url(#badge)');
    });

    it('shrinks and truncates a name that would overflow the card', () => {
        const long = buildOgSvg(eventRow({ person: 'Jean'.repeat(40) }));
        const size = Number(/font-size="(\d+(?:\.\d+)?)"[^>]*>Anniversaire/.exec(long)?.[1]);
        expect(size).toBeLessThan(76);
        expect(cardContent(eventRow({ person: 'Jean'.repeat(40) })).heading).toContain('…');
    });

    it('escapes event text into the SVG', () => {
        const svg = buildOgSvg(eventRow({ person: '<tspan>&"x"' }));
        expect(svg).not.toContain('<tspan>');
        expect(svg).toContain('&lt;tspan&gt;&amp;');
    });

    it('renders a 1200x630 PNG for every theme', () => {
        for (const theme of THEME_IDS) {
            const png = renderOgPng(eventRow({ theme }));
            expect(pngSize(png)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
        }
    });

    it('renders even when the event is empty', () => {
        const png = renderOgPng(eventRow({ person: '', age: '', date: '', time: '', town: '', location: '' }));
        expect(pngSize(png)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
    });

    it('describes the card in its alt text', () => {
        expect(ogImageAlt(eventRow())).toContain('Anniversaire de Léo');
    });
});

describe('Open Graph card (metadata)', () => {
    it('points og:image at the default event card and asks for the large layout', () => {
        const html = renderIndexHtml(SHELL, buildEventMeta(eventRow(), ORIGIN));
        expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/api/og.png" />`);
        expect(html).toContain(`content="${OG_WIDTH}"`);
        expect(html).toContain(`content="${OG_HEIGHT}"`);
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
        expect(html).toContain(`<meta name="twitter:image" content="${ORIGIN}/api/og.png" />`);
        expect(html).toContain('og:image:alt');
    });

    it('points a named event at its own card', () => {
        const meta = buildEventMeta(eventRow({ slug: 'anniv-lea', is_default: 0 }), ORIGIN);
        expect(meta.ogImage?.url).toBe(`${ORIGIN}/api/events/anniv-lea/og.png`);
    });

    it('includes the card in the JSON-LD', () => {
        expect(buildEventMeta(eventRow(), ORIGIN).jsonLd).toMatchObject({
            image: `${ORIGIN}/api/og.png`
        });
    });

    it('omits the image entirely when no origin is known', () => {
        // A relative og:image is ignored by every scraper, so emit none at all.
        const meta = buildEventMeta(eventRow(), '');
        expect(meta.ogImage).toBeUndefined();
        const html = renderIndexHtml(SHELL, meta);
        expect(html).not.toContain('og:image');
        expect(html).toContain('name="twitter:card" content="summary"');
    });
});

describe('Open Graph card (served)', () => {
    let app: ReturnType<typeof createApp>;
    let db: Db;
    let staticDir: string;
    let authCookie: string;

    beforeEach(async () => {
        staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-static-'));
        fs.writeFileSync(path.join(staticDir, 'index.html'), SHELL);
        db = await openDb(':memory:');
        await initSchema(db);
        const auth = createAuth(db.raw);
        await migrateAuth(auth);
        await seedAdminUser(auth, ADMIN.email, ADMIN.password);
        app = createApp(db, {
            auth,
            staticDir,
            rateLimits: { globalMax: 10000, rsvpMax: 10000, lookupMax: 10000, adminMax: 10000 }
        });
        const res = await request(app)
            .post('/api/auth/sign-in/email')
            .set('Origin', ORIGIN)
            .send(ADMIN)
            .expect(200);
        const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
        authCookie = (raw ?? []).map((c) => c.split(';')[0]).join('; ');
        db.run(
            `UPDATE event SET person = ?, age = ?, date = ?, town = ? WHERE is_default = 1`,
            ['Léo', '5', '2099-09-06', 'Artigues-près-Bordeaux']
        );
    });

    afterEach(() => {
        fs.rmSync(staticDir, { recursive: true, force: true });
    });

    it('serves the default event card as a PNG', async () => {
        const res = await request(app).get('/api/og.png').expect(200);
        expect(res.headers['content-type']).toBe('image/png');
        expect(res.headers['cache-control']).toContain('max-age');
        expect(pngSize(res.body)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
    });

    it('serves a named event card and 404s an unknown slug', async () => {
        await request(app)
            .post('/api/events')
            .set('Cookie', authCookie)
            .send({ person: 'Léa', age: '7', slug: 'anniv-lea', theme: 'unicorn' })
            .expect(201);
        const res = await request(app).get('/api/events/anniv-lea/og.png').expect(200);
        expect(pngSize(res.body)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });

        await request(app).get('/api/events/nope/og.png').expect(404);
    });

    it('revalidates with an ETag, and re-renders after the event is edited', async () => {
        const first = await request(app).get('/api/og.png').expect(200);
        const etag = first.headers.etag;
        expect(etag).toBeTruthy();
        await request(app).get('/api/og.png').set('If-None-Match', etag).expect(304);

        // updated_at is part of the cache key, so an edit must mint a new tag.
        db.run("UPDATE event SET person = 'Léa', updated_at = '2030-01-01 00:00:00' WHERE is_default = 1");
        const after = await request(app).get('/api/og.png').expect(200);
        expect(after.headers.etag).not.toBe(etag);
    });

    it('advertises the card from the invitation page', async () => {
        const res = await request(app).get('/').expect(200);
        expect(res.text).toContain(`<meta property="og:image" content="${ORIGIN}/api/og.png" />`);
        expect(res.text).toContain('summary_large_image');
    });
});
