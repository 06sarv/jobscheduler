-- 001_initial_schema.sql
-- Initial database schema for the distributed job scheduler
-- Run this before seeding any data

-- We need pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Users table
-- Basic user accounts. We keep it simple for now.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Organizations
-- Every user belongs to at least one org
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Organization members (join table)
-- Links users to orgs with a role
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- ============================================================
-- Projects
-- Projects live inside organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- ============================================================
-- Retry policies
-- Configurable retry strategies for queues
-- TODO: maybe add a 'jitter' option later?
-- ============================================================
CREATE TABLE IF NOT EXISTS retry_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    strategy VARCHAR(30) NOT NULL,
    max_retries INT DEFAULT 3,
    initial_delay_ms INT DEFAULT 1000,
    max_delay_ms INT DEFAULT 300000,
    backoff_multiplier DECIMAL(5,2) DEFAULT 2.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Queues
-- Each queue belongs to a project and has its own config
-- ============================================================
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    priority INT DEFAULT 0,
    concurrency_limit INT DEFAULT 5,
    retry_policy_id UUID REFERENCES retry_policies(id) ON DELETE SET NULL,
    max_queue_size INT DEFAULT 10000,
    status VARCHAR(20) DEFAULT 'active',
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);

-- ============================================================
-- Jobs
-- The main jobs table. This is where the magic happens
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255),
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    priority INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    retry_count INT DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(queue_id, idempotency_key)
);

-- ============================================================
-- Workers
-- NOTE: this must come before job_executions because
-- job_executions has a FK reference to workers
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'idle',
    queue_ids UUID[] NOT NULL,
    concurrency INT DEFAULT 3,
    current_load INT DEFAULT 0,
    hostname VARCHAR(255),
    pid INT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- ============================================================
-- Job executions
-- Each attempt at running a job gets its own execution record
-- ============================================================
CREATE TABLE IF NOT EXISTS job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    attempt_number INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Job logs
-- Structured log entries tied to a job/execution
-- ============================================================
CREATE TABLE IF NOT EXISTS job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES job_executions(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Scheduled jobs
-- For recurring / cron-based jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100),
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    is_recurring BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Worker heartbeats
-- Periodic health snapshots from workers
-- ============================================================
CREATE TABLE IF NOT EXISTS worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    active_jobs INT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Dead letter queue
-- Jobs that failed too many times end up here
-- TODO: add a way to bulk-retry from the DLQ
-- ============================================================
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    failure_reason TEXT NOT NULL,
    retry_count INT NOT NULL,
    original_payload JSONB NOT NULL,
    moved_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution VARCHAR(20)
);

-- ============================================================
-- Indexes
-- These should help with the most common query patterns
-- ============================================================

-- For claiming the next available job efficiently
-- The partial index on status='queued' keeps the index small
CREATE INDEX IF NOT EXISTS idx_jobs_claimable
    ON jobs(queue_id, priority DESC, created_at)
    WHERE status = 'queued';

-- General job status lookups
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Finding jobs that are due to run
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled
    ON jobs(scheduled_at)
    WHERE status = 'scheduled';

-- Looking up executions for a specific job
CREATE INDEX IF NOT EXISTS idx_executions_job ON job_executions(job_id, attempt_number);

-- Log retrieval by job + timestamp
CREATE INDEX IF NOT EXISTS idx_logs_job_ts ON job_logs(job_id, timestamp);

-- Finding active/idle workers
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);

-- Worker heartbeat history (most recent first)
CREATE INDEX IF NOT EXISTS idx_heartbeats_worker_ts ON worker_heartbeats(worker_id, timestamp DESC);

-- DLQ lookups by queue
CREATE INDEX IF NOT EXISTS idx_dlq_queue ON dead_letter_queue(queue_id, moved_at DESC);
