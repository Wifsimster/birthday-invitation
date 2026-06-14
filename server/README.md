# Birthday Invitation Backend

This is the Node.js backend server for the birthday invitation app with RSVP functionality.

> **Note:** For complete project documentation, see the main [README.md](../README.md) file.

## Features

- SQLite database for storing RSVP data
- Rate limiting to prevent spam
- CORS enabled for frontend communication
- Input validation and sanitization
- IP-based duplicate submission prevention

## API Endpoints

### Get All RSVPs
```
GET /api/rsvps
```
Returns all RSVP submissions (for admin purposes).

### Get RSVP Count
```
GET /api/rsvps/count
```
Returns the number of confirmations and total guests.

### Submit RSVP
```
POST /api/rsvp
```
Submit a new RSVP. Body should contain:
```json
{
  "name": "Child Name",
  "email": "parent@example.com",
  "phone": "06 12 34 56 78",
  "guests": 1
}
```

### Health Check
```
GET /api/health
```
Returns server status.

## Installation

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Database

The server uses SQLite with a simple schema:

```sql
CREATE TABLE rsvp (
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
);
```

The database file (`rsvp.db`) will be created automatically when the server starts.

## Security Features

- Rate limiting: 100 requests per 15 minutes per IP
- RSVP rate limiting: 5 RSVP submissions per hour per IP
- Helmet.js for security headers
- Input validation and sanitization
- IP-based duplicate submission prevention

## Configuration

The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable.
