import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testServer.js';

describe('RSVP API', () => {
    let app, db;

    beforeEach(async () => {
        const testApp = createTestApp();
        app = testApp.app;
        db = testApp.db;

        // Clear the database before each test
        return new Promise((resolve) => {
            db.run('DELETE FROM rsvp', resolve);
        });
    });

    describe('POST /api/rsvp', () => {
        it('should successfully submit a valid RSVP', async () => {
            const rsvpData = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+1234567890',
                guests: 2
            };

            const response = await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(201);

            expect(response.body).toMatchObject({
                message: 'RSVP submitted successfully!',
                id: expect.any(Number)
            });
        });

        it('should successfully submit RSVP with only required fields', async () => {
            const rsvpData = {
                name: 'Jane Smith'
            };

            const response = await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(201);

            expect(response.body).toMatchObject({
                message: 'RSVP submitted successfully!',
                id: expect.any(Number)
            });
        });

        it('should reject RSVP without name', async () => {
            const rsvpData = {
                email: 'test@example.com',
                guests: 1
            };

            const response = await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Name is required'
            });
        });

        it('should reject RSVP with empty name', async () => {
            const rsvpData = {
                name: '   ',
                email: 'test@example.com'
            };

            const response = await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Name is required'
            });
        });

        it('should reject RSVP with invalid guest count (too low)', async () => {
            const rsvpData = {
                name: 'Test User',
                guests: 0
            };

            const response = await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Number of guests must be between 1 and 10'
            });
        });

        it('should reject RSVP with invalid guest count (too high)', async () => {
            const rsvpData = {
                name: 'Test User',
                guests: 15
            };

            const response = await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Number of guests must be between 1 and 10'
            });
        });

        it('should accept valid guest counts within range', async () => {
            const testCases = [1, 5, 10];

            for (const guests of testCases) {
                const rsvpData = {
                    name: `Test User ${guests}`,
                    guests
                };

                await request(app)
                    .post('/api/rsvp')
                    .send(rsvpData)
                    .expect(201);
            }
        });

        it('should trim whitespace from name and email', async () => {
            const rsvpData = {
                name: '  John Doe  ',
                email: '  john@example.com  '
            };

            await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(201);

            // Verify the data was trimmed by checking the database
            const response = await request(app)
                .get('/api/rsvps')
                .expect(200);

            const rsvp = response.body.rsvps[0];
            expect(rsvp.name).toBe('John Doe');
            expect(rsvp.email).toBe('john@example.com');
        });
    });

    describe('GET /api/rsvps', () => {
        it('should return empty array when no RSVPs exist', async () => {
            const response = await request(app)
                .get('/api/rsvps')
                .expect(200);

            expect(response.body).toMatchObject({
                rsvps: []
            });
        });

        it('should return all RSVPs ordered by creation date (newest first)', async () => {
            // Create multiple RSVPs
            const rsvps = [
                { name: 'First Person', email: 'first@example.com' },
                { name: 'Second Person', email: 'second@example.com' },
                { name: 'Third Person', email: 'third@example.com' }
            ];

            // Submit RSVPs with small delays to ensure different timestamps
            for (const rsvp of rsvps) {
                await request(app).post('/api/rsvp').send(rsvp);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const response = await request(app)
                .get('/api/rsvps')
                .expect(200);

            expect(response.body.rsvps).toHaveLength(3);
            expect(response.body.rsvps[0].name).toBe('Third Person');
            expect(response.body.rsvps[1].name).toBe('Second Person');
            expect(response.body.rsvps[2].name).toBe('First Person');
        });
    });

    describe('GET /api/rsvps/count', () => {
        it('should return zero counts when no RSVPs exist', async () => {
            const response = await request(app)
                .get('/api/rsvps/count')
                .expect(200);

            expect(response.body).toMatchObject({
                confirmations: 0,
                total_guests: 0
            });
        });

        it('should return correct counts after RSVPs are submitted', async () => {
            const rsvps = [
                { name: 'Person 1', guests: 2 },
                { name: 'Person 2', guests: 3 },
                { name: 'Person 3', guests: 1 }
            ];

            for (const rsvp of rsvps) {
                await request(app).post('/api/rsvp').send(rsvp);
            }

            const response = await request(app)
                .get('/api/rsvps/count')
                .expect(200);

            expect(response.body).toMatchObject({
                confirmations: 3,
                total_guests: 6
            });
        });

        it('should handle default guest count of 1', async () => {
            await request(app)
                .post('/api/rsvp')
                .send({ name: 'Single Guest' });

            const response = await request(app)
                .get('/api/rsvps/count')
                .expect(200);

            expect(response.body).toMatchObject({
                confirmations: 1,
                total_guests: 1
            });
        });
    });

    describe('GET /api/health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'OK',
                timestamp: expect.any(String)
            });

            // Verify timestamp is a valid ISO string
            expect(() => new Date(response.body.timestamp)).not.toThrow();
        });
    });

    describe('RSVP Data Persistence', () => {
        it('should persist all RSVP fields correctly', async () => {
            const rsvpData = {
                name: 'Complete User',
                email: 'complete@example.com',
                phone: '+1-555-123-4567',
                guests: 4
            };

            await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(201);

            const response = await request(app)
                .get('/api/rsvps')
                .expect(200);

            const savedRsvp = response.body.rsvps[0];
            expect(savedRsvp).toMatchObject({
                name: rsvpData.name,
                email: rsvpData.email,
                phone: rsvpData.phone,
                guests: rsvpData.guests,
                id: expect.any(Number),
                ip_address: expect.any(String),
                created_at: expect.any(String),
                updated_at: expect.any(String)
            });
        });

        it('should handle null values for optional fields', async () => {
            const rsvpData = {
                name: 'Minimal User'
                // No email, phone, or guests specified
            };

            await request(app)
                .post('/api/rsvp')
                .send(rsvpData)
                .expect(201);

            const response = await request(app)
                .get('/api/rsvps')
                .expect(200);

            const savedRsvp = response.body.rsvps[0];
            expect(savedRsvp.name).toBe('Minimal User');
            expect(savedRsvp.email).toBeNull();
            expect(savedRsvp.phone).toBeNull();
            expect(savedRsvp.guests).toBe(1); // Default value
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/rsvp')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect(400);
        });

        it('should handle missing Content-Type header', async () => {
            const response = await request(app)
                .post('/api/rsvp')
                .send('name=Test')
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Name is required'
            });
        });
    });
});
