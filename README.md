# Distributed Job Scheduler

A production-inspired distributed job scheduling platform built to reliably execute asynchronous background jobs across multiple workers. Features configurable retry strategies, real-time monitoring, and a beautiful web dashboard.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### Core
- **Multi-queue job scheduling** — Projects can own multiple queues, each independently configurable
- **Atomic job claiming** — Workers claim jobs using `SELECT FOR UPDATE SKIP LOCKED`, preventing duplicate execution with zero contention
- **Concurrent execution** — Workers process multiple jobs simultaneously with a semaphore-based concurrency limiter
- **Complete job lifecycle** — `Queued → Scheduled → Claimed → Running → Completed/Failed/Dead`
- **Configurable retry strategies** — Fixed delay, linear backoff, and exponential backoff with jitter support
- **Dead Letter Queue** — Permanently failed jobs are moved to the DLQ for manual inspection and retry
- **Scheduled & recurring jobs** — Support for delayed execution and cron-based recurring schedules

### Backend
- RESTful API with JWT authentication and role-based access control
- Input validation on every endpoint (Joi)
- Structured error handling with custom error classes
- Pagination, filtering, and sorting on all list endpoints
- Rate limiting (general, auth, and heavy operation tiers)
- Idempotent job creation via `X-Idempotency-Key` header
- WebSocket real-time updates (Socket.IO)
- Graceful worker shutdown (waits for in-flight jobs on SIGTERM)
- Worker heartbeat monitoring with stale worker detection

### Frontend Dashboard
- Real-time system health overview with throughput charts
- Queue management — create, configure, pause/resume
- Job explorer with execution timeline and log viewer
- Worker monitoring with CPU/memory gauges
- Dead Letter Queue browser with retry/discard actions
- Dark theme with glassmorphism design
- Live connection indicator with WebSocket status

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express |
| Database | PostgreSQL 16 |
| Authentication | JWT + bcrypt |
| Real-time | Socket.IO |
| Frontend | React 18 (Vite) |
| Charts | Recharts |
| Styling | Vanilla CSS |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   REST API   │────▶│  PostgreSQL  │
│  (React SPA) │◀───│  (Express)   │◀───│   Database   │
└─────────────┘     └──────┬───────┘     └──────────────┘
       │                   │                      ▲
       │            ┌──────▼───────┐              │
       └───────────▶│  Socket.IO   │              │
                    └──────────────┘              │
                                                  │
┌──────────────┐    ┌──────────────┐              │
│   Worker 1   │───▶│   Executor   │──────────────┘
├──────────────┤    ├──────────────┤
│   Worker 2   │───▶│   Executor   │──────────────┘
├──────────────┤    ├──────────────┤
│   Worker N   │───▶│   Executor   │──────────────┘
└──────────────┘    └──────────────┘
```

Workers independently poll the database for claimable jobs, execute them concurrently, and report status back. The API server and workers share the same database but run as separate processes.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 16 (or Docker)
- npm

### 1. Clone and Install

```bash
git clone <repository-url>
cd codity

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Start PostgreSQL

Using Docker (recommended):
```bash
docker-compose up -d
```

Or connect to an existing PostgreSQL instance and update `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/jobscheduler
```

### 3. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your settings (defaults work with Docker)
```

### 4. Run Database Migrations & Seed

```bash
cd backend
npm run migrate    # Creates all tables and indexes
npm run seed       # Inserts demo data
```

### 5. Start the Backend

```bash
cd backend
npm run dev        # Starts on http://localhost:3000
```

### 6. Start the Frontend

```bash
cd frontend
npm run dev        # Starts on http://localhost:5173
```

### 7. Start a Worker (optional, separate terminal)

```bash
cd backend
node src/workers/WorkerProcess.js
```

### 8. Login

Open http://localhost:5173 and login with:
- **Admin**: admin@example.com / password123
- **Developer**: dev@example.com / password123

## API Documentation

See [docs/API.md](docs/API.md) for the complete API reference.

### Quick Examples

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'
```

**Create a Job:**
```bash
curl -X POST http://localhost:3000/api/jobs/queue/<queue-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.send",
    "payload": {"to": "user@example.com", "subject": "Hello"},
    "priority": 5
  }'
```

**Create a Batch of Jobs:**
```bash
curl -X POST http://localhost:3000/api/jobs/queue/<queue-id>/batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {"type": "email.send", "payload": {"to": "a@example.com"}},
      {"type": "email.send", "payload": {"to": "b@example.com"}}
    ]
  }'
```

## Database Schema

See [docs/DATABASE.md](docs/DATABASE.md) for the full schema documentation with ER diagram.

The system uses 12 tables in PostgreSQL:

| Table | Purpose |
|-------|---------|
| users | Platform users with roles |
| organizations | Multi-tenant organization support |
| organization_members | User-org membership with roles |
| projects | Project grouping for queues |
| retry_policies | Reusable retry configuration |
| queues | Job queues with priority and concurrency settings |
| jobs | Individual job entries with full lifecycle tracking |
| job_executions | Execution attempt records per job |
| job_logs | Structured execution logs |
| scheduled_jobs | Cron and delayed job schedules |
| workers | Registered worker processes |
| worker_heartbeats | Periodic health metrics from workers |
| dead_letter_queue | Permanently failed jobs for review |

## Job Lifecycle

```
                    ┌──────────┐
       create       │  QUEUED  │
      ───────────▶ │          │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │ (delayed)    │ (immediate)  │
          ▼              │              │
   ┌──────────┐         │              │
   │SCHEDULED │─────────┘              │
   └──────────┘  (when due)            │
                         │              │
                         ▼              │
                  ┌──────────┐         │
                  │ CLAIMED  │◀────────┘
                  └────┬─────┘
                       │ (worker starts execution)
                       ▼
                ┌──────────┐
                │ RUNNING  │
                └────┬─────┘
               ┌─────┴──────┐
               │             │
               ▼             ▼
        ┌──────────┐  ┌──────────┐
        │COMPLETED │  │  FAILED  │
        └──────────┘  └────┬─────┘
                           │
                    ┌──────┴──────┐
                    │ retries     │ max retries
                    │ remaining   │ exceeded
                    ▼             ▼
             ┌──────────┐  ┌──────────┐
             │SCHEDULED │  │   DEAD   │──▶ Dead Letter Queue
             │(retry)   │  └──────────┘
             └──────────┘
```

## Retry Strategies

| Strategy | Formula | Example (base=1s) |
|----------|---------|-------------------|
| Fixed | `base_delay` | 1s, 1s, 1s, 1s |
| Linear | `base_delay × attempt` | 1s, 2s, 3s, 4s |
| Exponential | `min(base_delay × 2^attempt, max_delay)` | 1s, 2s, 4s, 8s |

All strategies support optional jitter to prevent thundering herd problems.

## Project Structure

```
codity/
├── docker-compose.yml          # PostgreSQL container
├── backend/
│   ├── src/
│   │   ├── index.js            # Server entry point
│   │   ├── config/             # Database, env, socket config
│   │   ├── middleware/         # Auth, RBAC, validation, rate limiting
│   │   ├── routes/             # Express route definitions
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic
│   │   ├── workers/            # Worker process, executor, heartbeat
│   │   ├── db/                 # Migrations, seeds, queries
│   │   ├── utils/              # Logger, errors, crypto
│   │   └── constants/          # Job states, retry strategies
│   └── tests/                  # Jest + Supertest
├── frontend/
│   ├── src/
│   │   ├── api/                # API client modules
│   │   ├── components/         # React components
│   │   ├── context/            # Auth & Socket context
│   │   ├── hooks/              # Custom hooks
│   │   └── pages/              # Page components
│   └── public/
└── docs/                       # API, database, architecture docs
```

## License

MIT
