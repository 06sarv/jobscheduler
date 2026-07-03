-- seed.sql
-- Demo data for local development
-- Uses deterministic UUIDs so it's easy to reference stuff
-- Safe to run multiple times thanks to ON CONFLICT DO NOTHING

-- ============================================
-- Users
-- password is 'password123' for both (bcrypt hash)
-- ============================================
INSERT INTO users (id, email, password_hash, full_name, role) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'admin@example.com',
    '$2a$10$AV5C6tBoGTS.VwPeRukFZOdDn1acURjgT/Bi7xT0VAyppsUwguCGS',
    'Alice Admin',
    'admin'
),
(
    '22222222-2222-2222-2222-222222222222',
    'dev@example.com',
    '$2a$10$AV5C6tBoGTS.VwPeRukFZOdDn1acURjgT/Bi7xT0VAyppsUwguCGS',
    'Bob Developer',
    'member'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Organization
-- ============================================
INSERT INTO organizations (id, name, slug) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    'Acme Corp',
    'acme-corp'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Org members
-- Both users belong to Acme Corp
-- ============================================
INSERT INTO organization_members (id, organization_id, user_id, role) VALUES
(
    '44444444-4444-4444-4444-444444444401',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'admin'
),
(
    '44444444-4444-4444-4444-444444444402',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'member'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================
-- Project
-- ============================================
INSERT INTO projects (id, organization_id, name, description, created_by) VALUES
(
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    'Main Platform',
    'Our primary platform project for managing scheduled jobs and background processing',
    '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (organization_id, name) DO NOTHING;

-- ============================================
-- Retry policies
-- Three different strategies to test with
-- ============================================
INSERT INTO retry_policies (id, name, strategy, max_retries, initial_delay_ms, max_delay_ms, backoff_multiplier) VALUES
(
    '66666666-6666-6666-6666-666666666601',
    'Fixed Retry',
    'fixed',
    3,
    5000,
    5000,
    1.0
),
(
    '66666666-6666-6666-6666-666666666602',
    'Linear Backoff',
    'linear',
    5,
    1000,
    60000,
    1.0
),
(
    '66666666-6666-6666-6666-666666666603',
    'Exponential Backoff',
    'exponential',
    4,
    1000,
    300000,
    2.0
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Queues
-- ============================================
INSERT INTO queues (id, project_id, name, priority, concurrency_limit, retry_policy_id, max_queue_size, status, tags) VALUES
(
    '77777777-7777-7777-7777-777777777701',
    '55555555-5555-5555-5555-555555555555',
    'email-notifications',
    10,
    10,
    '66666666-6666-6666-6666-666666666601',
    5000,
    'active',
    '["email", "notifications"]'
),
(
    '77777777-7777-7777-7777-777777777702',
    '55555555-5555-5555-5555-555555555555',
    'report-generation',
    5,
    3,
    '66666666-6666-6666-6666-666666666603',
    1000,
    'active',
    '["reports", "heavy"]'
),
(
    '77777777-7777-7777-7777-777777777703',
    '55555555-5555-5555-5555-555555555555',
    'data-processing',
    1,
    5,
    '66666666-6666-6666-6666-666666666602',
    10000,
    'active',
    '["data", "etl"]'
)
ON CONFLICT (project_id, name) DO NOTHING;

-- ============================================
-- Workers
-- Just one worker for demo purposes
-- ============================================
INSERT INTO workers (id, name, status, queue_ids, concurrency, current_load, hostname, pid, metadata) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    'worker-alpha-01',
    'active',
    ARRAY[
        '77777777-7777-7777-7777-777777777701'::UUID,
        '77777777-7777-7777-7777-777777777702'::UUID,
        '77777777-7777-7777-7777-777777777703'::UUID
    ],
    3,
    1,
    'dev-machine.local',
    12345,
    '{"version": "1.0.0", "region": "us-east-1"}'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Jobs
-- Mix of statuses so the dashboard looks interesting
-- ============================================
INSERT INTO jobs (id, queue_id, idempotency_key, type, payload, status, priority, max_retries, retry_count, scheduled_at, started_at, completed_at, created_by) VALUES
-- Queued jobs (waiting to be picked up)
(
    '88888888-8888-8888-8888-888888880001',
    '77777777-7777-7777-7777-777777777701',
    'welcome-email-user-42',
    'send_email',
    '{"to": "newuser@example.com", "template": "welcome", "vars": {"name": "Charlie"}}',
    'queued',
    5,
    3, 0, NULL, NULL, NULL,
    '22222222-2222-2222-2222-222222222222'
),
(
    '88888888-8888-8888-8888-888888880002',
    '77777777-7777-7777-7777-777777777701',
    'password-reset-user-99',
    'send_email',
    '{"to": "forgetful@example.com", "template": "password_reset", "vars": {"reset_link": "https://app.example.com/reset/abc123"}}',
    'queued',
    10,
    3, 0, NULL, NULL, NULL,
    '11111111-1111-1111-1111-111111111111'
),
(
    '88888888-8888-8888-8888-888888880003',
    '77777777-7777-7777-7777-777777777703',
    'csv-import-batch-7',
    'import_csv',
    '{"file_url": "https://storage.example.com/uploads/data.csv", "row_count": 15000}',
    'queued',
    0,
    5, 0, NULL, NULL, NULL,
    '22222222-2222-2222-2222-222222222222'
),
-- Running jobs
(
    '88888888-8888-8888-8888-888888880004',
    '77777777-7777-7777-7777-777777777702',
    'monthly-report-june',
    'generate_report',
    '{"report_type": "monthly_summary", "month": "2026-06", "format": "pdf"}',
    'running',
    5,
    3, 0, NULL,
    NOW() - INTERVAL '2 minutes', NULL,
    '11111111-1111-1111-1111-111111111111'
),
(
    '88888888-8888-8888-8888-888888880005',
    '77777777-7777-7777-7777-777777777703',
    'sync-external-api-daily',
    'api_sync',
    '{"source": "external_crm", "endpoint": "/api/v2/contacts", "batch_size": 500}',
    'running',
    3,
    3, 0, NULL,
    NOW() - INTERVAL '45 seconds', NULL,
    '22222222-2222-2222-2222-222222222222'
),
-- Completed jobs
(
    '88888888-8888-8888-8888-888888880006',
    '77777777-7777-7777-7777-777777777701',
    'invoice-email-order-100',
    'send_email',
    '{"to": "customer@example.com", "template": "invoice", "vars": {"order_id": "ORD-100", "amount": "$249.99"}}',
    'completed',
    5,
    3, 0, NULL,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '59 minutes',
    '11111111-1111-1111-1111-111111111111'
),
(
    '88888888-8888-8888-8888-888888880007',
    '77777777-7777-7777-7777-777777777702',
    'weekly-report-w26',
    'generate_report',
    '{"report_type": "weekly_analytics", "week": "2026-W26", "format": "xlsx"}',
    'completed',
    5,
    3, 0, NULL,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '2 hours 55 minutes',
    '22222222-2222-2222-2222-222222222222'
),
(
    '88888888-8888-8888-8888-888888880008',
    '77777777-7777-7777-7777-777777777703',
    'thumbnail-batch-42',
    'generate_thumbnails',
    '{"image_ids": [101, 102, 103, 104, 105], "sizes": ["sm", "md", "lg"]}',
    'completed',
    0,
    3, 0, NULL,
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '4 hours 58 minutes',
    '22222222-2222-2222-2222-222222222222'
),
-- Failed job
(
    '88888888-8888-8888-8888-888888880009',
    '77777777-7777-7777-7777-777777777701',
    'notification-blast-promo',
    'send_email',
    '{"to": "biglist@example.com", "template": "promo_blast", "vars": {"campaign": "summer_sale"}}',
    'failed',
    2,
    3, 3, NULL,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '28 minutes',
    '11111111-1111-1111-1111-111111111111'
),
-- Dead job (moved to DLQ)
(
    '88888888-8888-8888-8888-888888880010',
    '77777777-7777-7777-7777-777777777703',
    'etl-pipeline-legacy',
    'run_etl',
    '{"pipeline": "legacy_migration", "source_db": "old_system", "tables": ["orders", "customers"]}',
    'dead',
    1,
    3, 3, NULL,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 50 minutes',
    '22222222-2222-2222-2222-222222222222'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Job executions
-- A few execution records for the completed and failed jobs
-- ============================================
INSERT INTO job_executions (id, job_id, worker_id, attempt_number, status, started_at, completed_at, duration_ms, error_message, result) VALUES
-- Successful execution for the invoice email
(
    '99999999-9999-9999-9999-999999990001',
    '88888888-8888-8888-8888-888888880006',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    1,
    'completed',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '59 minutes',
    1230,
    NULL,
    '{"message_id": "msg_abc123", "delivered": true}'
),
-- Successful execution for the weekly report
(
    '99999999-9999-9999-9999-999999990002',
    '88888888-8888-8888-8888-888888880007',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    1,
    'completed',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '2 hours 55 minutes',
    298500,
    NULL,
    '{"file_url": "https://storage.example.com/reports/weekly_w26.xlsx", "pages": 12}'
),
-- Failed attempts for the promo blast email (tried 3 times)
(
    '99999999-9999-9999-9999-999999990003',
    '88888888-8888-8888-8888-888888880009',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    1,
    'failed',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '29 minutes 30 seconds',
    30000,
    'SMTP connection timeout: unable to reach mail server',
    NULL
),
(
    '99999999-9999-9999-9999-999999990004',
    '88888888-8888-8888-8888-888888880009',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    2,
    'failed',
    NOW() - INTERVAL '29 minutes',
    NOW() - INTERVAL '28 minutes 45 seconds',
    15000,
    'SMTP connection refused: server overloaded',
    NULL
),
(
    '99999999-9999-9999-9999-999999990005',
    '88888888-8888-8888-8888-888888880009',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    3,
    'failed',
    NOW() - INTERVAL '28 minutes 30 seconds',
    NOW() - INTERVAL '28 minutes',
    30000,
    'SMTP connection timeout: giving up after max retries',
    NULL
),
-- Execution for the currently running report
(
    '99999999-9999-9999-9999-999999990006',
    '88888888-8888-8888-8888-888888880004',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    1,
    'running',
    NOW() - INTERVAL '2 minutes',
    NULL,
    NULL,
    NULL,
    NULL
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Job logs
-- Some log entries for the completed and failed jobs
-- ============================================
INSERT INTO job_logs (id, job_id, execution_id, level, message, metadata) VALUES
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001',
    '88888888-8888-8888-8888-888888880006',
    '99999999-9999-9999-9999-999999990001',
    'info',
    'Starting email delivery to customer@example.com',
    '{"template": "invoice"}'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002',
    '88888888-8888-8888-8888-888888880006',
    '99999999-9999-9999-9999-999999990001',
    'info',
    'Email delivered successfully',
    '{"message_id": "msg_abc123", "status_code": 200}'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003',
    '88888888-8888-8888-8888-888888880009',
    '99999999-9999-9999-9999-999999990003',
    'error',
    'Failed to connect to SMTP server after 30s timeout',
    '{"smtp_host": "mail.example.com", "port": 587}'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004',
    '88888888-8888-8888-8888-888888880009',
    '99999999-9999-9999-9999-999999990005',
    'error',
    'Max retries exhausted. Moving job to dead letter queue.',
    '{"total_attempts": 3, "last_error": "SMTP connection timeout"}'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005',
    '88888888-8888-8888-8888-888888880004',
    '99999999-9999-9999-9999-999999990006',
    'info',
    'Report generation started - fetching data for June 2026',
    '{"report_type": "monthly_summary", "estimated_rows": 45000}'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Dead letter queue entries
-- Two jobs that completely failed
-- ============================================
INSERT INTO dead_letter_queue (id, original_job_id, queue_id, failure_reason, retry_count, original_payload, moved_at, resolved_at, resolved_by, resolution) VALUES
(
    'cccccccc-cccc-cccc-cccc-ccccccccc001',
    '88888888-8888-8888-8888-888888880009',
    '77777777-7777-7777-7777-777777777701',
    'SMTP server unreachable after 3 retry attempts',
    3,
    '{"to": "biglist@example.com", "template": "promo_blast", "vars": {"campaign": "summer_sale"}}',
    NOW() - INTERVAL '28 minutes',
    NULL,
    NULL,
    NULL
),
(
    'cccccccc-cccc-cccc-cccc-ccccccccc002',
    '88888888-8888-8888-8888-888888880010',
    '77777777-7777-7777-7777-777777777703',
    'Legacy database connection pool exhausted, migration tables not found',
    3,
    '{"pipeline": "legacy_migration", "source_db": "old_system", "tables": ["orders", "customers"]}',
    NOW() - INTERVAL '1 hour 50 minutes',
    NOW() - INTERVAL '1 hour',
    '11111111-1111-1111-1111-111111111111',
    'discarded'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Worker heartbeats
-- A couple of recent heartbeat snapshots
-- ============================================
INSERT INTO worker_heartbeats (id, worker_id, cpu_usage, memory_usage, active_jobs) VALUES
(
    'dddddddd-dddd-dddd-dddd-ddddddddd001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    23.50,
    45.80,
    1
),
(
    'dddddddd-dddd-dddd-dddd-ddddddddd002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001',
    18.20,
    44.10,
    2
)
ON CONFLICT DO NOTHING;
