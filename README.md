# StrayCare Backend

The StrayCare backend is a TypeScript API built with Express. It provides authentication, profiles, rescue workflows, community features, donations, file uploads, notifications, and real-time chat and calls through Socket.IO.

## Requirements

- Node.js 20 LTS (supported range: `>=20 <23`)
- MongoDB, or the repository's test database setup

## Setup

```bash
npm install
copy .env.example .env
```

Fill in `.env` before starting the server. `MESSAGE_ENCRYPTION_KEY` must be a 64-character hexadecimal value. `MONGO_URI` is required for normal development; the server can fall back to an in-memory database when it is absent.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the TypeScript server with watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Generate a Jest coverage report |
| `npm run kill-port` | Free the configured development port |

The server uses port `5000` by default and automatically tries the next available ports. Check the health endpoint at `http://localhost:5000/ping`.

## Main directories

- `src/routes` - Express route modules
- `src/controllers` - Request handlers
- `src/services` - Application and integration services
- `src/models` - Mongoose models
- `src/sockets` - Socket.IO event handlers
- `tests` - Integration and end-to-end tests

## Testing

Run the test suite with:

```bash
npm test
```

Keep credentials, Firebase service-account files, and production secrets out of version control.
