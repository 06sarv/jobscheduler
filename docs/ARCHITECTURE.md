# Architecture Documentation

## System Overview

The Distributed Job Scheduler is designed as a multi-process system with three main components that communicate through a shared PostgreSQL database and WebSocket connections.

```
┌───────────────────────────────────────────────────────┐
│                    Client Layer                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │            React SPA (Dashboard)                 │  │
│  │  • Queue management    • Job monitoring          │  │
│  │  • Worker status       • DLQ inspection          │  │
│  │  • Real-time updates   • Throughput charts       │  │
│  └─────────────────────────┬───────────────────────┘  │
│                            │ REST + WebSocket          │
└────────────────────────────┼──────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────┐
│                    API Server                          │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────────┐│
│  │  Routes   │ │Middleware│ │     Socket.IO          ││
│  │  ────────▶│ │ • Auth   │ │  • Real-time events    ││
│  │Controllers│ │ • RBAC   │ │  • Job status changes  ││
│  │  ────────▶│ │ • Validate│ │  • Worker heartbeats  ││
│  │ Services  │ │ • RateLimit│ │                      ││
│  └──────────┘ └──────────┘ └────────────────────────┘│
│       │                                               │
│  ┌────▼──────────────────────────────────────────┐   │
│  │            Scheduler Service                   │   │
│  │  • Moves scheduled→queued when due             │   │
│  │  • Handles cron expression evaluation          │   │
│  │  • Runs every 1 second                         │   │
│  └───────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────┐
│                    PostgreSQL                          │
│  12 tables • Partial indexes • SKIP LOCKED support    │
└────────────────────────────▲──────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────┐
│                    Worker Processes                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Poll Loop   │  │  Executor    │  │  Heartbeat │  │
│  │  (claim jobs)│──▶│  (run job)   │  │  (30s)     │  │
│  │              │  │  (concurrent)│  │  (CPU/mem)  │  │
│  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                       │
│  • Atomic job claiming (FOR UPDATE SKIP LOCKED)       │
│  • Semaphore-based concurrency limiting               │
│  • Graceful shutdown on SIGTERM/SIGINT                 │
└───────────────────────────────────────────────────────┘
```

## Design Principles

### 1. At-Most-Once Delivery
Jobs are claimed atomically using PostgreSQL's `FOR UPDATE SKIP LOCKED`. This guarantees that a job is assigned to exactly one worker. If a worker crashes mid-execution, the job remains in 'running' state. A stale worker detection mechanism can then reclaim it.

### 2. Separation of Concerns
- **API Server**: Handles HTTP requests, authentication, and WebSocket connections. Does not execute jobs.
- **Worker Process**: Only claims and executes jobs. Does not serve HTTP requests. Can run as a separate process or on a separate machine.
- **Scheduler Service**: Runs within the API server process. Handles time-based job transitions.

### 3. Fail-Safe Defaults
- Jobs default to 3 retries with a fixed 1-second delay
- Workers default to concurrency of 3
- Rate limits are applied to all API endpoints
- All inputs are validated before processing

### 4. Observability
Every job execution is tracked with:
- An `job_executions` record with timing and status
- Structured `job_logs` entries with levels (info, warn, error, debug)
- Worker heartbeat history for post-mortem analysis

## Concurrency Model

### Worker Poll Loop
```
while (not shutting down):
    if (current_load < max_concurrency):
        job = atomic_claim()  # SELECT FOR UPDATE SKIP LOCKED
        if (job):
            execute_async(job)  # Don't await — run concurrently
        else:
            sleep(poll_interval)  # Back off when queue empty
    else:
        sleep(100ms)  # At capacity, check again shortly
```

### Why SKIP LOCKED?
Traditional `SELECT FOR UPDATE` blocks when another transaction holds the lock. With 10 workers all trying to claim jobs, this creates a serialization bottleneck.

`SKIP LOCKED` tells PostgreSQL: "If any rows matching my query are already locked by another transaction, silently skip them and give me the next available one."

Result: Zero contention, zero deadlocks, near-linear scaling with worker count.

## Retry Architecture

```
Job Fails
    │
    ▼
Check retry_count < max_retries?
    │
    ├── YES: Compute next delay based on strategy
    │         Set status = 'scheduled'
    │         Set scheduled_at = NOW() + delay
    │         Increment retry_count
    │         (Scheduler picks it up when due)
    │
    └── NO:  Set status = 'dead'
             Insert into dead_letter_queue
             Emit dlq:new_entry event
```

### Delay Calculation

| Strategy | Formula |
|----------|---------|
| Fixed | `initial_delay_ms` |
| Linear | `initial_delay_ms × (attempt + 1)` |
| Exponential | `min(initial_delay_ms × 2^attempt, max_delay_ms)` |

Jitter can be applied to prevent thundering herd: `delay = random(0, computed_delay)`

## Security

### Authentication Flow
1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. Server returns a JWT access token (24h) and refresh token (7d)
3. Client includes access token in `Authorization: Bearer <token>` header
4. When access token expires, client uses refresh token to get a new one
5. Refresh tokens are rotated on each use

### Authorization
- Role-based access control (RBAC) at the organization level
- Roles: `admin`, `member`, `viewer`
- Admin: Full access
- Member: CRUD on queues and jobs
- Viewer: Read-only access

### API Security
- Helmet for HTTP header hardening
- CORS configured for frontend origin only
- Rate limiting at three tiers (auth, general, heavy)
- Input validation on every endpoint (Joi schemas)
- SQL injection prevention via parameterized queries

## WebSocket Architecture

```
Client connects → Socket.IO handshake → JWT verification
    │
    ▼
Authenticated connection established
    │
    ▼
Server emits events on state changes:
    • job:created
    • job:status_changed
    • worker:heartbeat
    • queue:stats_updated
    • dlq:new_entry
    │
    ▼
Client receives events → Updates React state → Re-renders UI
```

Events are emitted from the executor service and heartbeat emitter, ensuring the dashboard reflects changes within seconds.

## Graceful Shutdown

When the worker receives SIGTERM or SIGINT:

1. Stop the poll loop (no new jobs claimed)
2. Clear heartbeat interval
3. Wait for all in-flight jobs to complete (with 30s timeout)
4. Update worker status to 'offline' in database
5. Close database connection
6. Exit process

This ensures no jobs are left in an inconsistent state during deployments.
