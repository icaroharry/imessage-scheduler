# iMessage Scheduler

A fullstack iMessage scheduling system with a FIFO queue, configurable send intervals, and a delivery dashboard.

## Architecture

```
packages/
├── web/       → Next.js 16 + shadcn/ui + Tailwind (UI + Dashboard)
├── api/       → Hono + SQLite via Drizzle ORM (REST API + FIFO scheduler)
└── gateway/   → Hono + osascript (iMessage sending + status reporting)
```

### Message Flow

```
User → POST /messages → QUEUED
                          ↓  (scheduler picks next, FIFO by created_at)
                        ACCEPTED
                          ↓  (calls gateway POST /send)
                        SENT → osascript → Messages.app → iMessage
                          ↓
                        DELIVERED (or FAILED)
```

## Prerequisites

- **macOS** (required for iMessage gateway)
- **Node.js** >= 20
- **pnpm** >= 9
- Signed into **iMessage** on your Mac
- **Full Disk Access** granted to your terminal (System Settings → Privacy & Security → Full Disk Access) — needed for the gateway to interact with Messages.app

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start all services (API on :3001, Gateway on :3002, Web on :3000)
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Services

| Service | Port | Description |
|---------|------|-------------|
| **Web** | 3000 | Schedule messages + dashboard UI |
| **API** | 3001 | REST API + FIFO queue scheduler |
| **Gateway** | 3002 | iMessage sending via osascript |

## Configuration

The scheduler sends **one message per hour** by default. This is configurable via the API:

```bash
# Set interval to 30 minutes (in milliseconds)
curl -X PATCH http://localhost:3001/config \
  -H "Content-Type: application/json" \
  -d '{"sendIntervalMs": 1800000}'

# Check current config
curl http://localhost:3001/config
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3001` | API server port |
| `GATEWAY_PORT` | `3002` | Gateway server port |
| `DATABASE_URL` | `./data/scheduler.db` | SQLite database path |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL for the frontend |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/messages` | Schedule a new message |
| `GET` | `/messages` | List messages (supports `?status=QUEUED&limit=50&offset=0`) |
| `GET` | `/messages/:id` | Get a specific message |
| `PATCH` | `/messages/:id` | Update message status |
| `DELETE` | `/messages/:id` | Cancel a queued message |
| `GET` | `/messages/stats/summary` | Dashboard statistics |
| `GET` | `/config` | Get scheduler configuration |
| `PATCH` | `/config` | Update scheduler configuration |

## Running Tests

```bash
# Run all tests
pnpm test

# Run only API tests
pnpm --filter @imessage-scheduler/api test

# Run only gateway tests
pnpm --filter @imessage-scheduler/gateway test
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Hono, better-sqlite3, Drizzle ORM, Zod
- **Gateway**: Hono, osascript (AppleScript)
- **Testing**: Vitest (in-memory SQLite for API tests, mocked osascript for gateway)
- **Monorepo**: pnpm workspaces
