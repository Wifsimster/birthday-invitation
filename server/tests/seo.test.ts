import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { createAuth, migrateAuth, seedAdminUser } from '../src/auth.ts';
import { openDb, initSchema, type Db } from '../src/db.ts';
import type { EventRow } from '../src/db.ts';
import {
    buildEventMeta,
    buildRobotsTxt,
    buildSitemapXml,
    escapeHtml,
    indexingAllowed,
    renderIndexHtml,
    resolveOrigin
} from '../src/seo.ts';

process.env.BETTER_AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnop';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';

const ADMIN = { email: 'admin@example.com', password: 'secret-password' };
const ORIGIN = 'http://localhost:3000';

// A minimal stand-in for the built shell, carrying the same markers as
// frontend/index.html so the injection path under test is the real one.
const SHELL = `<!DOCTYPE html>
<html lang="fr">
<head>
    <title>Invitation d'anniversaire</title>
    <!--seo-->
    <meta name="description" content="generic build-time default" />
    <meta property="og:title" content="Invitation d'anniversaire" />
    <!--/seo-->
</head>
<body><div id="app"></div></body>
</html>`;

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
    created_at: '2025-01-01 10:00:00',
    updated_at: '2025-02-03 10:00:00',
    ...overrides
});

describe('SEO metadata (unit)', () => {
    it('builds a title and description from the event details', () => {
        const meta = buildEventMeta(eventRow(), ORIGIN);
        expect(meta.title).toBe('Anniversaire de Léo — 5 ans | Invitation');
        expect(meta.description).toContain('Léo fête ses 5 ans !');
        expect(meta.description).toContain('dimanche 6 septembre 2099');
        expect(meta.description).toContain('Artigues-près-Bordeaux');
        expect(meta.description).toContain("Réponds à l'invitation");
        expect(meta.canonical).toBe(`${ORIGIN}/`);
        expect(meta.robots).toBe('index, follow');
    });

    it('points the canonical of a named event at its /e/<slug> URL', () => {
        const meta = buildEventMeta(eventRow({ slug: 'anniv-lea', is_default: 0 }), ORIGIN);
        expect(meta.canonical).toBe(`${ORIGIN}/e/anniv-lea`);
    });

    it('says so when RSVPs are closed', () => {
        const meta = buildEventMeta(eventRow({ rsvp_deadline: '2020-01-01' }), ORIGIN);
        expect(meta.description).toContain('Les réponses sont closes.');
    });

    it('emits schema.org Event JSON-LD when a date is set, and none without', () => {
        expect(buildEventMeta(eventRow(), ORIGIN).jsonLd).toMatchObject({
            '@type': 'Event',
            name: 'Anniversaire de Léo (5 ans)',
            startDate: '2099-09-06'
        });
        expect(buildEventMeta(eventRow({ date: '' }), ORIGIN).jsonLd).toBeUndefined();
    });

    it('falls back to noindex placeholder copy for an unnamed event', () => {
        const meta = buildEventMeta(eventRow({ person: '' }), ORIGIN);
        expect(meta.robots).toBe('noindex, nofollow');
    });

    it('marks the page noindex when indexing is disabled', () => {
        expect(buildEventMeta(eventRow(), ORIGIN, false).robots).toBe('noindex, follow');
    });

    it('escapes HTML so event text cannot inject markup', () => {
        expect(escapeHtml('<script>"x"</script>')).toBe(
            '&lt;script&gt;&quot;x&quot;&lt;/script&gt;'
        );
    });

    it('replaces the shell markers rather than duplicating the defaults', () => {
        const html = renderIndexHtml(SHELL, buildEventMeta(eventRow(), ORIGIN));
        expect(html).not.toContain('generic build-time default');
        expect(html).not.toContain('<!--seo-->');
        expect(html.match(/property="og:title"/g)).toHaveLength(1);
        expect(html).toContain('<title>Anniversaire de Léo — 5 ans | Invitation</title>');
    });

    it('emits JSON-LD that actually parses, with no HTML entities', () => {
        // A <script> element's content is raw text: HTML-escaping the payload
        // would leave crawlers with &quot; instead of a quote, i.e. broken JSON.
        const html = renderIndexHtml(SHELL, buildEventMeta(eventRow(), ORIGIN));
        const payload = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
        expect(payload).toBeTruthy();
        expect(payload).not.toContain('&quot;');
        expect(JSON.parse(payload as string)).toMatchObject({ '@type': 'Event', startDate: '2099-09-06' });
    });

    it('neutralises a closing script tag hidden in event text', () => {
        const meta = buildEventMeta(eventRow({ person: '</script><img src=x>' }), ORIGIN);
        const html = renderIndexHtml(SHELL, meta);
        const payload = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
        expect(payload).not.toContain('</script>');
        expect(JSON.parse(payload as string).name).toContain('</script>');
    });

    it('appends the block before </head> when the shell has no markers', () => {
        const html = renderIndexHtml('<html><head><title>x</title></head><body></body></html>',
            buildEventMeta(eventRow(), ORIGIN));
        expect(html).toContain('rel="canonical"');
        expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('</head>'));
    });

    it('prefers the configured origin over the request host', () => {
        const req = { protocol: 'http', get: () => 'attacker.example' };
        expect(resolveOrigin(req, { PUBLIC_BASE_URL: 'https://party.example/' }))
            .toBe('https://party.example');
    });

    it('falls back to the request host, but only a syntactically valid one', () => {
        expect(resolveOrigin({ protocol: 'https', get: () => 'party.example' }, {}))
            .toBe('https://party.example');
        expect(resolveOrigin({ protocol: 'https', get: () => 'evil.example/"><script>' }, {}))
            .toBe('');
    });

    it('reads the indexing opt-out from the environment', () => {
        expect(indexingAllowed({})).toBe(true);
        expect(indexingAllowed({ SEO_ALLOW_INDEXING: 'false' })).toBe(false);
        expect(indexingAllowed({ SEO_ALLOW_INDEXING: '0' })).toBe(false);
        expect(indexingAllowed({ SEO_ALLOW_INDEXING: 'true' })).toBe(true);
    });

    it('keeps crawlers away from the admin console and the API', () => {
        const txt = buildRobotsTxt(ORIGIN);
        expect(txt).toContain('Disallow: /admin');
        expect(txt).toContain('Disallow: /login');
        expect(txt).toContain('Disallow: /register');
        expect(txt).toContain('Disallow: /api/');
        expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
        expect(buildRobotsTxt(ORIGIN, false)).toContain('Disallow: /');
    });

    it('lists every invitation in the sitemap', () => {
        const xml = buildSitemapXml(
            [eventRow(), eventRow({ id: 2, slug: 'anniv-lea', is_default: 0 })],
            ORIGIN
        );
        expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
        expect(xml).toContain(`<loc>${ORIGIN}/e/anniv-lea</loc>`);
        expect(xml).toContain('<lastmod>2025-02-03</lastmod>');
    });
});

describe('SEO metadata (served pages)', () => {
    let app: ReturnType<typeof createApp>;
    let db: Db;
    let staticDir: string;
    let authCookie: string;

    beforeEach(async () => {
        staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-static-'));
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
            `UPDATE event SET person = ?, age = ?, date = ?, time = ?, town = ?, location = ?
             WHERE is_default = 1`,
            ['Léo', '5', '2099-09-06', '15h00 - 17h00', 'Artigues-près-Bordeaux', 'Chez Léo']
        );
    });

    afterEach(() => {
        fs.rmSync(staticDir, { recursive: true, force: true });
    });

    it('describes the default event on /', async () => {
        const res = await request(app).get('/').expect(200);
        expect(res.headers['content-type']).toMatch(/html/);
        expect(res.text).toContain('<title>Anniversaire de Léo — 5 ans | Invitation</title>');
        expect(res.text).toContain('property="og:title"');
        expect(res.text).toContain(`<link rel="canonical" href="${ORIGIN}/" />`);
        expect(res.text).toContain('application/ld+json');
        expect(res.text).not.toContain('generic build-time default');
    });

    it('describes the requested event on /e/<slug>', async () => {
        await request(app)
            .post('/api/events')
            .set('Cookie', authCookie)
            .send({ person: 'Léa', age: '7', date: '2099-10-01', slug: 'anniv-lea' })
            .expect(201);

        const res = await request(app).get('/e/anniv-lea').expect(200);
        expect(res.text).toContain('<title>Anniversaire de Léa — 7 ans | Invitation</title>');
        expect(res.text).toContain(`href="${ORIGIN}/e/anniv-lea"`);
    });

    it('keeps /admin and unknown invitations out of the index', async () => {
        for (const url of ['/admin', '/e/nope']) {
            const res = await request(app).get(url).expect(200);
            expect(res.text).toContain('content="noindex, nofollow"');
        }
    });

    it('escapes event text injected into the shell', async () => {
        db.run('UPDATE event SET person = ? WHERE is_default = 1', ['<script>alert(1)</script>']);
        const res = await request(app).get('/').expect(200);
        expect(res.text).not.toContain('<script>alert(1)</script>');
        expect(res.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('serves robots.txt and a sitemap covering every event', async () => {
        await request(app)
            .post('/api/events')
            .set('Cookie', authCookie)
            .send({ person: 'Léa', slug: 'anniv-lea' })
            .expect(201);

        const robots = await request(app).get('/robots.txt').expect(200);
        expect(robots.headers['content-type']).toMatch(/text\/plain/);
        expect(robots.text).toContain('Disallow: /admin');
        expect(robots.text).toContain('Disallow: /login');
        expect(robots.text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

        const sitemap = await request(app).get('/sitemap.xml').expect(200);
        expect(sitemap.headers['content-type']).toMatch(/xml/);
        expect(sitemap.text).toContain(`<loc>${ORIGIN}/</loc>`);
        expect(sitemap.text).toContain(`<loc>${ORIGIN}/e/anniv-lea</loc>`);
    });

    it('answers a HEAD probe on an invitation', async () => {
        // Some chat link scrapers probe with HEAD before fetching the page.
        await request(app).head('/').expect(200);
    });

    it('redirects /index.html to the canonical URL', async () => {
        const res = await request(app).get('/index.html').expect(301);
        expect(res.headers.location).toBe('/');
    });

    it('still serves JSON 404s for unknown API routes', async () => {
        const res = await request(app).get('/api/nope').expect(404);
        expect(res.body).toEqual({ error: 'Ressource introuvable' });
    });
});
