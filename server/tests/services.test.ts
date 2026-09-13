/*
 * The service layer, driven without Express and without SQLite.
 *
 * These tests exist as much to prove the seams as to check the rules: every
 * dependency below is a hand-written stand-in for a repository interface, so if
 * a use-case ever reaches past its port for a database handle, it stops
 * compiling here rather than silently binding itself to SQLite again.
 */
import { describe, it, expect, vi } from 'vitest';
import { createEventService } from '../src/services/event.service.ts';
import { createRsvpService } from '../src/services/rsvp.service.ts';
import { createOgCardService } from '../src/services/og-card.service.ts';
import { DomainError } from '../src/domain/errors.ts';
import type { EventRow } from '../src/db.ts';
import type {
  EventCounts, EventRepository, RsvpRecord, RsvpRepository, RsvpSummary, SettingsRepository
} from '../src/repositories/types.ts';

const eventRow = (over: Partial<EventRow> = {}): EventRow => ({
    id: 1,
    slug: 'default',
    person: 'Léo',
    age: '7',
    date: '2030-06-15',
    time: '15h00',
    town: 'Lyon',
    location: 'Chez Léo',
    dress_code: '',
    theme: 'kid',
    rsvp_deadline: '',
    is_default: 1,
    owner_id: null,
    created_at: '2030-01-01 00:00:00',
    updated_at: '2030-01-01 00:00:00',
    ...over
});

/** An event repository backed by a plain array. */
function fakeEvents(rows: EventRow[] = []): EventRepository & { rows: EventRow[] } {
    let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
    return {
        rows,
        findById: (id) => rows.find((r) => r.id === id),
        findBySlug: (slug) => rows.find((r) => r.slug === slug),
        findDefault: () => rows.find((r) => r.is_default) ?? rows[0],
        listAll: () => rows,
        listWithCounts: (ownerId) =>
            rows
                .filter((r) => ownerId === undefined || r.owner_id === ownerId)
                .map((r) => ({ ...r, responses: 0, confirmations: 0, declined: 0, total_guests: 0 })) as
                (EventRow & EventCounts)[],
        slugTaken: (slug, exceptId) => rows.some((r) => r.slug === slug && r.id !== exceptId),
        insert: (data) => {
            const row = eventRow({ ...data, id: nextId++, is_default: 0 });
            rows.push(row);
            return row;
        },
        update: (id, data) => {
            const row = rows.find((r) => r.id === id);
            if (!row) return undefined;
            Object.assign(row, data);
            return row;
        },
        updateTheme: (id, theme) => {
            const row = rows.find((r) => r.id === id);
            if (row) row.theme = theme;
        },
        deleteById: (id) => {
            const at = rows.findIndex((r) => r.id === id);
            if (at === -1) return 0;
            rows.splice(at, 1);
            return 1;
        },
        deleteByOwner: (ownerId) => {
            const before = rows.length;
            for (let i = rows.length - 1; i >= 0; i--) if (rows[i].owner_id === ownerId) rows.splice(i, 1);
            return before - rows.length;
        }
    };
}

const noSettings: SettingsRepository = { get: () => undefined };

const service = (rows: EventRow[] = [eventRow()]) => {
    const events = fakeEvents(rows);
    return {
        events,
        service: createEventService({
            events,
            settings: noSettings,
            fallbackConfig: { person: '', age: '', date: '', time: '', town: '', location: '' }
        })
    };
};

const ADMIN = { id: 'admin-1', role: 'admin' as const };
const MEMBER = { id: 'user-1', role: 'user' as const };

describe('event service', () => {
    it('lists every event for an admin and only its own for a member', () => {
        const { service: events } = service([
            eventRow(),
            eventRow({ id: 2, slug: 'lea', is_default: 0, owner_id: 'user-1' }),
            eventRow({ id: 3, slug: 'tom', is_default: 0, owner_id: 'user-2' })
        ]);
        expect(events.listFor(ADMIN)).toHaveLength(3);
        expect(events.listFor(MEMBER).map((e) => e.slug)).toEqual(['lea']);
    });

    it("hides another account's event behind a 404 rather than a 403", () => {
        const { service: events } = service([eventRow({ id: 2, is_default: 0, owner_id: 'user-2' })]);
        expect(() => events.requireManageable(MEMBER, 2)).toThrow(DomainError);
        try {
            events.requireManageable(MEMBER, 2);
        } catch (err) {
            expect((err as DomainError).kind).toBe('not_found');
        }
    });

    it('derives a unique slug from the person when none is given', () => {
        const { service: events } = service([eventRow({ id: 2, slug: 'lea', is_default: 0 })]);
        const created = events.create(MEMBER, { person: 'Léa' });
        expect(created.slug).toBe('lea-2');
        expect(created.owner_id).toBe('user-1');
    });

    it('refuses a slug another event already holds', () => {
        const { service: events } = service([eventRow({ id: 2, slug: 'lea', is_default: 0 })]);
        expect(() => events.create(MEMBER, { person: 'Léa', slug: 'lea' }))
            .toThrow(/déjà utilisé/);
    });

    it('keeps the default event and its slug', () => {
        const { service: events } = service();
        expect(() => events.remove(ADMIN, 1)).toThrow(/par défaut/);
        expect(events.update(ADMIN, 1, { slug: 'renamed' }).slug).toBe('default');
    });

    it('seeds the default event once, then leaves it alone', () => {
        const { events: repo, service: events } = service([eventRow({ person: '' })]);
        const cfg = {
            person: 'Léo', age: '7', date: '2030-06-15', time: '15h', town: 'Lyon',
            location: 'Chez Léo', dressCode: 'Pyjama', rsvpDeadline: '2030-06-01'
        };
        expect(events.seedDefault(cfg).person).toBe('Léo');
        expect(events.seedDefault({ ...cfg, person: 'Autre' }).person).toBe('Léo');
        expect(repo.rows[0].dress_code).toBe('Pyjama');
    });
});

/** An RSVP repository backed by a plain array. */
function fakeRsvps(): RsvpRepository & { rows: (RsvpRecord & { id: number })[] } {
    const rows: (RsvpRecord & { id: number })[] = [];
    let nextId = 1;
    const summary = (row: RsvpRecord & { id: number }): RsvpSummary => ({
        id: row.id,
        attending: row.attending,
        name: row.name,
        email: row.email,
        phone: row.phone,
        guests: row.guests,
        dietary_restrictions: row.dietary_restrictions,
        message: row.message,
        share_response: row.share_response
    });
    return {
        rows,
        listByEvent: () => [],
        countsByEvent: () => ({
            total_responses: rows.length,
            confirmations: rows.filter((r) => r.attending === 'yes').length,
            declined: rows.filter((r) => r.attending === 'no').length,
            total_guests: rows.reduce((n, r) => n + (r.attending === 'yes' ? r.guests : 0), 0)
        }),
        findByPhone: (_e, phone) => rows.find((r) => r.phone === phone) as never,
        findSummaryByPhone: (_e, phone) => {
            const row = rows.find((r) => r.phone === phone);
            return row && summary(row);
        },
        findSummaryById: (_e, id) => {
            const row = rows.find((r) => r.id === id);
            return row && summary(row);
        },
        phoneTaken: (_e, phone, except) => rows.some((r) => r.phone === phone && r.id !== except),
        insert: (_e, record) => {
            rows.push({ ...record, id: nextId });
            return nextId++;
        },
        update: (_e, id, record) => {
            const row = rows.find((r) => r.id === id);
            if (!row) return 0;
            Object.assign(row, record);
            return 1;
        },
        updateById: (id, record) => {
            const row = rows.find((r) => r.id === id);
            if (!row) return 0;
            Object.assign(row, record, { phone: row.phone });
            return 1;
        },
        deleteById: (_e, id) => {
            const at = rows.findIndex((r) => r.id === id);
            if (at === -1) return 0;
            rows.splice(at, 1);
            return 1;
        },
        sharedParticipants: () =>
            rows.filter((r) => r.attending === 'yes' && r.share_response === 1)
                .map((r) => ({ name: r.name, guests: r.guests }))
    };
}

const OPEN = { person: 'Léo', age: '7', date: '2030-06-15', time: '', town: '', location: '' };
const CLOSED = { ...OPEN, rsvpDeadline: '2000-01-01' };
const guest = (over: Record<string, unknown> = {}) => ({
    attending: 'yes' as const, name: 'Ana', phone: '06 12 34 56 78', guests: 2, ...over
});

describe('rsvp service', () => {
    it('normalises the phone number so spacing never creates a second row', () => {
        const repo = fakeRsvps();
        const rsvps = createRsvpService(repo);
        const first = rsvps.submit(1, OPEN, guest(), null);
        const second = rsvps.submit(1, OPEN, guest({ phone: '+33612345678', name: 'Ana B' }), null);
        expect(first.created).toBe(true);
        // A different number: the leading + is kept, so this is a new guest.
        expect(second.created).toBe(true);
        expect(rsvps.submit(1, OPEN, guest({ phone: '0612-34-56-78' }), null))
            .toEqual({ id: first.id, created: false });
        expect(repo.rows).toHaveLength(2);
    });

    it('clears the guest count and the sharing consent on a decline', () => {
        const repo = fakeRsvps();
        const rsvps = createRsvpService(repo);
        rsvps.submit(1, OPEN, guest({ share_response: true }), null);
        expect(repo.rows[0]).toMatchObject({ guests: 2, share_response: 1 });
        rsvps.submit(1, OPEN, guest({ attending: 'no' }), null);
        expect(repo.rows[0]).toMatchObject({ guests: 0, share_response: 0 });
    });

    it('keeps the stored consent when an admin edit omits it', () => {
        const repo = fakeRsvps();
        const rsvps = createRsvpService(repo);
        const { id } = rsvps.submit(1, OPEN, guest({ share_response: true }), null);
        rsvps.edit(1, id, guest({ name: 'Ana Corrigée' }));
        expect(repo.rows[0]).toMatchObject({ name: 'Ana Corrigée', share_response: 1 });
    });

    it('refuses a submission once the deadline has passed', () => {
        const rsvps = createRsvpService(fakeRsvps());
        expect(() => rsvps.submit(1, CLOSED, guest(), null)).toThrow(/closes/);
    });

    it('refuses to move a response onto a number another guest holds', () => {
        const repo = fakeRsvps();
        const rsvps = createRsvpService(repo);
        const a = rsvps.submit(1, OPEN, guest({ phone: '0611111111' }), null);
        rsvps.submit(1, OPEN, guest({ phone: '0622222222', name: 'Bea' }), null);
        expect(() => rsvps.edit(1, a.id, guest({ phone: '0622222222' }))).toThrow(/existe déjà/);
    });

    it('answers the guest list only to a confirmed guest, and only with opt-ins', () => {
        const repo = fakeRsvps();
        const rsvps = createRsvpService(repo);
        rsvps.submit(1, OPEN, guest({ phone: '0611111111', share_response: true }), null);
        rsvps.submit(1, OPEN, guest({ phone: '0622222222', name: 'Bea' }), null);
        rsvps.submit(1, OPEN, guest({ phone: '0633333333', name: 'Cid', attending: 'no' }), null);

        expect(() => rsvps.sharedGuests(1, '0633333333')).toThrow(/confirmé/);
        expect(() => rsvps.sharedGuests(1, '0699999999')).toThrow(/confirmé/);
        const list = rsvps.sharedGuests(1, '0622222222');
        expect(list.participants).toEqual([{ name: 'Ana', guests: 2 }]);
        expect(list).toMatchObject({ shared_count: 1, confirmations: 2, you_share: false });
    });

    it('reports a missing response as not found rather than an empty body', () => {
        const rsvps = createRsvpService(fakeRsvps());
        expect(() => rsvps.lookup(1, '0600000000')).toThrow(/Aucune réponse/);
        expect(() => rsvps.remove(1, 'not-a-number')).toThrow(/non trouvé/);
    });
});

describe('og card service', () => {
    it('renders once per event version and evicts the oldest card when full', () => {
        const render = vi.fn(() => Buffer.from('png'));
        const cards = createOgCardService(render, 2);
        const row = eventRow();

        expect(cards.cardFor(row).etag).toBe('W/"og-1:2030-01-01 00:00:00:kid"');
        cards.cardFor(row);
        expect(render).toHaveBeenCalledTimes(1);

        // An edit changes updated_at, so the stored card is no longer reused.
        cards.cardFor({ ...row, updated_at: '2030-02-02 00:00:00' });
        expect(render).toHaveBeenCalledTimes(2);

        // A third distinct card evicts the first, which then has to re-render.
        cards.cardFor({ ...row, id: 2 });
        cards.cardFor(row);
        expect(render).toHaveBeenCalledTimes(4);
    });
});
