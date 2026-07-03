# Database Design

## Overview

The Distributed Job Scheduler uses PostgreSQL 16 with a normalized relational schema consisting of 12 tables. The design prioritizes data integrity, query performance, and support for concurrent access patterns.

## ER Diagram

```
┌──────────┐     ┌─────────────────────┐     ┌──────────┐
│  users   │────▶│ organization_members │◀────│  orgs    │
└────┬─────┘     └─────────────────────┘     └────┬─────┘
     │                                             │
     │ created_by                                  │
     ▼                                             ▼
┌──────────┐                                ┌──────────┐
│   jobs   │◀───────────────────────────────│ projects │
└────┬─────┘                                └────┬─────┘
     │                                           │
     │    ┌───────────────┐   ┌──────────┐       │
     ├───▶│job_executions │──▶│ workers  │       │
     │    └───────────────┘   └────┬─────┘       │
     │                             │              │
     │    ┌───────────────┐   ┌────▼─────────┐   │
     ├───▶│   job_logs    │   │worker_hearts │   │
     │    └───────────────┘   └──────────────┘   │
     │                                           │
     │    ┌───────────────┐   ┌──────────────┐   │
     ├───▶│scheduled_jobs │   │retry_policies│   │
     │    └───────────────┘   └──────┬───────┘   │
     │                               │           │
     │    ┌───────────────┐   ┌──────▼───────┐   │
     └───▶│dead_letter_q  │◀──│   queues     │◀──┘
          └───────────────┘   └──────────────┘
```

## Tables

### users
Stores platform user accounts.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| full_name | VARCHAR(100) | NOT NULL |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'member' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Notes:** Passwords are hashed with bcrypt (12 rounds). The `role` field controls global permissions: 'admin', 'member', or 'viewer'.

### organizations
Multi-tenant organization support.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| slug | VARCHAR(100) | UNIQUE, NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### organization_members
Maps users to organizations with roles.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| organization_id | UUID | FK → organizations ON DELETE CASCADE |
| user_id | UUID | FK → users ON DELETE CASCADE |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'member' |
| joined_at | TIMESTAMPTZ | DEFAULT NOW() |

**Unique Constraint:** (organization_id, user_id) — prevents duplicate membership.

### projects
Groups queues under a project within an organization.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| organization_id | UUID | FK → organizations ON DELETE CASCADE |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | |
| created_by | UUID | FK → users |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Unique Constraint:** (organization_id, name) — no duplicate project names per org.

### retry_policies
Reusable retry configuration that can be assigned to queues.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| strategy | VARCHAR(30) | NOT NULL |
| max_retries | INTEGER | NOT NULL, DEFAULT 3 |
| initial_delay_ms | INTEGER | NOT NULL, DEFAULT 1000 |
| max_delay_ms | INTEGER | DEFAULT 300000 |
| backoff_multiplier | DECIMAL(5,2) | DEFAULT 2.0 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Strategies:**
- `fixed`: Constant delay between retries
- `linear`: Delay increases linearly (base × attempt)
- `exponential`: Delay doubles each attempt (base × 2^attempt), capped at max_delay_ms

### queues
Job queues with priority and concurrency configuration.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK → projects ON DELETE CASCADE |
| name | VARCHAR(100) | NOT NULL |
| priority | INTEGER | NOT NULL, DEFAULT 0 |
| concurrency_limit | INTEGER | DEFAULT 5 |
| retry_policy_id | UUID | FK → retry_policies ON DELETE SET NULL |
| max_queue_size | INTEGER | DEFAULT 10000 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' |
| tags | JSONB | DEFAULT '[]' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Status values:** 'active', 'paused', 'draining'

### jobs
Individual job entries tracking the complete lifecycle.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| queue_id | UUID | FK → queues ON DELETE CASCADE |
| idempotency_key | VARCHAR(255) | |
| type | VARCHAR(100) | NOT NULL |
| payload | JSONB | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'queued' |
| priority | INTEGER | DEFAULT 0 |
| max_retries | INTEGER | DEFAULT 3 |
| retry_count | INTEGER | DEFAULT 0 |
| scheduled_at | TIMESTAMPTZ | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| created_by | UUID | FK → users |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Status lifecycle:** queued → scheduled → claimed → running → completed/failed → dead

### job_executions
Records each execution attempt for a job.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| job_id | UUID | FK → jobs ON DELETE CASCADE |
| worker_id | UUID | FK → workers ON DELETE SET NULL |
| attempt_number | INTEGER | NOT NULL |
| status | VARCHAR(20) | NOT NULL |
| started_at | TIMESTAMPTZ | NOT NULL |
| completed_at | TIMESTAMPTZ | |
| duration_ms | INTEGER | |
| error_message | TEXT | |
| result | JSONB | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### job_logs
Structured log entries from job execution.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| job_id | UUID | FK → jobs ON DELETE CASCADE |
| execution_id | UUID | FK → job_executions ON DELETE CASCADE |
| level | VARCHAR(10) | NOT NULL |
| message | TEXT | NOT NULL |
| metadata | JSONB | |
| timestamp | TIMESTAMPTZ | DEFAULT NOW() |

### scheduled_jobs
Cron and delayed job schedules.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| job_id | UUID | FK → jobs ON DELETE CASCADE |
| cron_expression | VARCHAR(100) | |
| next_run_at | TIMESTAMPTZ | NOT NULL |
| last_run_at | TIMESTAMPTZ | |
| is_recurring | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| timezone | VARCHAR(50) | DEFAULT 'UTC' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### workers
Registered worker processes.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'idle' |
| queue_ids | UUID[] | NOT NULL |
| concurrency | INTEGER | DEFAULT 3 |
| current_load | INTEGER | DEFAULT 0 |
| hostname | VARCHAR(255) | |
| pid | INTEGER | |
| started_at | TIMESTAMPTZ | DEFAULT NOW() |
| last_heartbeat_at | TIMESTAMPTZ | DEFAULT NOW() |
| metadata | JSONB | DEFAULT '{}' |

### worker_heartbeats
Periodic health metrics from workers.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| worker_id | UUID | FK → workers ON DELETE CASCADE |
| cpu_usage | DECIMAL(5,2) | |
| memory_usage | DECIMAL(5,2) | |
| active_jobs | INTEGER | |
| timestamp | TIMESTAMPTZ | DEFAULT NOW() |

### dead_letter_queue
Permanently failed jobs moved here for inspection.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| original_job_id | UUID | FK → jobs ON DELETE CASCADE |
| queue_id | UUID | FK → queues ON DELETE CASCADE |
| failure_reason | TEXT | NOT NULL |
| retry_count | INTEGER | NOT NULL |
| original_payload | JSONB | NOT NULL |
| moved_at | TIMESTAMPTZ | DEFAULT NOW() |
| resolved_at | TIMESTAMPTZ | |
| resolved_by | UUID | FK → users |
| resolution | VARCHAR(20) | |

## Indexes

| Index | Table | Columns | Type | Purpose |
|-------|-------|---------|------|---------|
| idx_jobs_claimable | jobs | (queue_id, priority DESC, created_at) | Partial (WHERE status='queued') | Hot path: worker job claiming |
| idx_jobs_status | jobs | (status) | B-tree | Dashboard filtering by status |
| idx_jobs_scheduled | jobs | (scheduled_at) | Partial (WHERE status='scheduled') | Scheduler finding due jobs |
| idx_executions_job | job_executions | (job_id, attempt_number) | B-tree | Execution history lookup |
| idx_logs_job_ts | job_logs | (job_id, timestamp) | B-tree | Chronological log retrieval |
| idx_workers_status | workers | (status) | B-tree | Active worker queries |
| idx_heartbeats_worker_ts | worker_heartbeats | (worker_id, timestamp DESC) | B-tree | Latest heartbeat lookup |
| idx_dlq_queue | dead_letter_queue | (queue_id, moved_at DESC) | B-tree | DLQ browsing by queue |

## Key Design Decisions

### Normalization (3NF)
All tables are in Third Normal Form. No transitive dependencies. Retry policies are a separate entity to enable reuse across queues.

### UUID Primary Keys
UUIDs prevent sequential ID enumeration (security) and allow distributed generation without coordination.

### Foreign Key Cascading
- `ON DELETE CASCADE`: Parent deletion removes children (org→project→queue→job)
- `ON DELETE SET NULL`: Preserves records when referenced entity is removed (worker assignment)

### Partial Indexes
The `idx_jobs_claimable` partial index only covers rows with `status = 'queued'`, keeping the index small and fast for the critical claiming hot path.

### JSONB for Flexible Data
`payload`, `tags`, and `metadata` use JSONB for schema flexibility while maintaining indexability (GIN indexes can be added if needed).

### Atomic Job Claiming
```sql
UPDATE jobs
SET status = 'claimed', started_at = NOW(), updated_at = NOW()
WHERE id = (
    SELECT id FROM jobs
    WHERE queue_id = ANY($1)
      AND status = 'queued'
      AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`FOR UPDATE SKIP LOCKED` ensures:
1. The selected row is exclusively locked for the duration of the transaction
2. If another worker has already locked a row, it's silently skipped (no blocking, no deadlocks)
3. Each worker always gets a unique job — no duplicate execution is possible
