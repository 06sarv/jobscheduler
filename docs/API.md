# API Documentation

Base URL: `http://localhost:3000/api`

All endpoints (except auth) require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

## Authentication

### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "fullName": "John Doe", "role": "member" },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

### POST /auth/login
Authenticate and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "fullName": "...", "role": "..." },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

### POST /auth/refresh
Refresh an expired access token.

**Request Body:**
```json
{
  "refreshToken": "jwt..."
}
```

### GET /auth/me
Get current user profile. Requires authentication.

---

## Organizations

### POST /organizations
Create a new organization.

**Request Body:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

### GET /organizations/:id
Get organization details.

### PUT /organizations/:id
Update organization.

### GET /organizations/:id/members
List organization members.

### POST /organizations/:id/members
Add a member to the organization.

**Request Body:**
```json
{
  "userId": "uuid",
  "role": "member"
}
```

---

## Projects

### POST /projects
Create a new project.

**Request Body:**
```json
{
  "organizationId": "uuid",
  "name": "My Project",
  "description": "Optional description"
}
```

### GET /projects/:id
Get project details.

### GET /projects/organization/:orgId
List projects in an organization.

### PUT /projects/:id
Update project.

### DELETE /projects/:id
Delete project and all its queues/jobs.

---

## Queues

### POST /queues
Create a new queue.

**Request Body:**
```json
{
  "projectId": "uuid",
  "name": "email-queue",
  "priority": 10,
  "concurrencyLimit": 5,
  "retryPolicyId": "uuid",
  "maxQueueSize": 10000,
  "tags": ["email", "notifications"]
}
```

### GET /queues/:id
Get queue details.

### GET /queues/project/:projectId
List queues in a project.

### PUT /queues/:id
Update queue configuration.

### DELETE /queues/:id
Delete queue and all its jobs.

### POST /queues/:id/pause
Pause a queue. Workers will stop claiming new jobs from this queue.

### POST /queues/:id/resume
Resume a paused queue.

### GET /queues/:id/stats
Get queue statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "queued": 45,
    "scheduled": 10,
    "running": 5,
    "completed": 80,
    "failed": 8,
    "dead": 2
  }
}
```

---

## Jobs

### POST /jobs/queue/:queueId
Create a single job.

**Request Body:**
```json
{
  "type": "email.send",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome!",
    "body": "Hello and welcome to our platform."
  },
  "priority": 5,
  "scheduledAt": "2024-01-15T10:00:00Z",
  "maxRetries": 5
}
```

**Headers (optional):**
- `X-Idempotency-Key: unique-key-123` — Prevents duplicate job creation

### POST /jobs/queue/:queueId/batch
Create multiple jobs in a single transaction.

**Request Body:**
```json
{
  "jobs": [
    { "type": "email.send", "payload": { "to": "a@example.com" } },
    { "type": "email.send", "payload": { "to": "b@example.com" } },
    { "type": "email.send", "payload": { "to": "c@example.com" } }
  ]
}
```

### GET /jobs/:id
Get job details including execution history.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "email.send",
    "status": "completed",
    "payload": { ... },
    "priority": 5,
    "retryCount": 1,
    "maxRetries": 3,
    "createdAt": "...",
    "startedAt": "...",
    "completedAt": "...",
    "executions": [
      {
        "id": "uuid",
        "attemptNumber": 1,
        "status": "failed",
        "startedAt": "...",
        "completedAt": "...",
        "durationMs": 2340,
        "errorMessage": "Connection timeout"
      },
      {
        "id": "uuid",
        "attemptNumber": 2,
        "status": "completed",
        "startedAt": "...",
        "completedAt": "...",
        "durationMs": 1205
      }
    ]
  }
}
```

### GET /jobs/queue/:queueId
List jobs in a queue with pagination and filtering.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| status | string | - | Filter by status |
| type | string | - | Filter by job type |
| sort | string | created_at | Sort field |
| order | string | desc | Sort order (asc/desc) |

### POST /jobs/:id/cancel
Cancel a queued or scheduled job.

### POST /jobs/:id/retry
Manually retry a failed job.

### GET /jobs/:id/logs
Get execution logs for a job.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "level": "info",
      "message": "Job execution started",
      "metadata": { "workerId": "uuid" },
      "timestamp": "2024-01-15T10:00:01Z"
    },
    {
      "id": "uuid",
      "level": "error",
      "message": "Connection refused",
      "metadata": { "host": "smtp.example.com", "port": 587 },
      "timestamp": "2024-01-15T10:00:03Z"
    }
  ]
}
```

---

## Workers

### GET /workers
List all registered workers.

### GET /workers/:id
Get worker details.

### GET /workers/:id/heartbeats
Get worker heartbeat history.

**Query Parameters:**
- `limit` (number, default 50) — Number of heartbeats to return

---

## Dashboard

### GET /dashboard/health
Get overall system health metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalJobs": 1542,
    "activeWorkers": 3,
    "completedToday": 287,
    "failedToday": 12,
    "successRate": 95.8,
    "avgExecutionTime": 2340,
    "queueDepth": 45
  }
}
```

### GET /dashboard/throughput
Get job throughput over time.

**Query Parameters:**
- `range` (string, default "24h") — Time range: "1h", "6h", "24h", "7d"

### GET /dashboard/queue-stats
Get per-queue statistics.

### GET /dashboard/worker-stats
Get per-worker statistics.

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

### Status Codes
| Code | Meaning |
|------|---------|
| 400 | Bad Request — Invalid input or validation failure |
| 401 | Unauthorized — Missing or invalid token |
| 403 | Forbidden — Insufficient permissions |
| 404 | Not Found — Resource doesn't exist |
| 409 | Conflict — Duplicate resource (idempotency violation) |
| 429 | Too Many Requests — Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limits

| Tier | Limit | Endpoints |
|------|-------|-----------|
| Auth | 10 req/min | /auth/login, /auth/register |
| General | 100 req/min | All other endpoints |
| Heavy | 20 req/min | Batch operations, dashboard aggregates |

## WebSocket Events

Connect to the Socket.IO server at the same URL as the API. Include the JWT token as an auth parameter:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `job:created` | `{ jobId, queueId, type }` | New job created |
| `job:status_changed` | `{ jobId, oldStatus, newStatus, queueId }` | Job state transition |
| `worker:heartbeat` | `{ workerId, cpuUsage, memoryUsage, activeJobs }` | Worker health update |
| `queue:stats_updated` | `{ queueId, depth, processing }` | Queue metrics change |
| `dlq:new_entry` | `{ dlqId, jobId, queueId, failureReason }` | New dead letter entry |
