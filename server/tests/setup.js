import { beforeAll, afterAll } from 'vitest';
import sqlite3 from 'sqlite3';
import fs from 'fs';

// Test database setup
let testDb;

beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync('test-rsvp.db')) {
        fs.unlinkSync('test-rsvp.db');
    }

    // Create test database
    testDb = new sqlite3.Database('test-rsvp.db');

    // Create the table for testing
    return new Promise((resolve, reject) => {
        testDb.run(`CREATE TABLE IF NOT EXISTS rsvp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      guests INTEGER DEFAULT 1,
      dietary_restrictions TEXT,
      message TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

afterAll(async () => {
    // Close test database and clean up
    if (testDb) {
        return new Promise((resolve) => {
            testDb.close(() => {
                if (fs.existsSync('test-rsvp.db')) {
                    fs.unlinkSync('test-rsvp.db');
                }
                resolve();
            });
        });
    }
});

export { testDb };
