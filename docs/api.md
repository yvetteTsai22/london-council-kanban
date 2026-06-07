# London Council Kanban — External API Reference

Base URL: `http://your-host` (no path prefix)

All endpoints return JSON. All request bodies must be `Content-Type: application/json`.

> **Authentication:** Not required in the current version. Auth middleware is planned for a future iteration.

---

## Tickets

### List tickets

```
GET /api/tickets
```

Returns all tickets. Optionally filter by status, department, or priority.

**Query parameters**

| Parameter | Type | Values |
|-----------|------|--------|
| `status` | string | `new` `in_progress` `review` `done` |
| `department` | string | Any department string, e.g. `Highways` |
| `priority` | string | `low` `medium` `high` `critical` |

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "ref": "LCI-001",
      "title": "Pothole on High Street",
      "status": "new",
      "priority": "high",
      "department": "Highways",
      "description": null,
      "assigneeId": null,
      "dueDate": null,
      "createdAt": "2026-06-01T10:00:00Z",
      "updatedAt": "2026-06-01T10:00:00Z"
    }
  ]
}
```

---

### Get a single ticket

```
GET /api/tickets/:id
```

Returns a ticket with its comments, activity log, and resolved assignee.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Ticket ID |

**Response 200**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "ref": "LCI-001",
    "title": "Pothole on High Street",
    "status": "new",
    "priority": "high",
    "department": "Highways",
    "description": "Large pothole near junction",
    "assigneeId": 3,
    "dueDate": "2026-06-15",
    "createdAt": "2026-06-01T10:00:00Z",
    "updatedAt": "2026-06-01T10:00:00Z",
    "assignee": {
      "id": 3,
      "name": "Jane Smith"
    },
    "comments": [
      {
        "id": 10,
        "body": "Site inspection scheduled",
        "authorName": "Council Officer",
        "createdAt": "2026-06-02T09:00:00Z"
      }
    ],
    "activity": [
      {
        "id": 5,
        "action": "moved to in_progress",
        "actorName": "Council Officer",
        "createdAt": "2026-06-02T09:05:00Z"
      }
    ]
  }
}
```

**Response 400** — non-numeric id  
**Response 404** — ticket not found

---

### Create a ticket

```
POST /api/tickets
```

Creates a new ticket. Fires a `ticket.created` webhook event.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Ticket title |
| `priority` | string | ✅ | `low` `medium` `high` `critical` |
| `department` | string | ✅ | Responsible department |
| `description` | string | — | Optional detail |
| `assigneeId` | integer | — | Team member ID |
| `dueDate` | string | — | ISO date string, e.g. `2026-06-30` |

```json
{
  "title": "Broken streetlight",
  "priority": "medium",
  "department": "Streetworks",
  "description": "Light out on Park Lane since Monday",
  "dueDate": "2026-06-20"
}
```

**Response 201**

```json
{
  "success": true,
  "data": {
    "id": 17,
    "ref": "LCI-017",
    "title": "Broken streetlight",
    "status": "new",
    "priority": "medium",
    "department": "Streetworks",
    "description": "Light out on Park Lane since Monday",
    "assigneeId": null,
    "dueDate": "2026-06-20",
    "createdAt": "2026-06-07T11:30:00Z",
    "updatedAt": "2026-06-07T11:30:00Z"
  }
}
```

**Response 400** — missing required fields or invalid JSON  
**Response 500** — database error

---

## Webhooks

Register URLs to receive event notifications when tickets change.

### List webhooks

```
GET /api/webhooks
```

Returns all active webhook registrations.

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "url": "https://your-system.example.com/hooks/kanban",
      "events": ["ticket.created", "ticket.status_changed"],
      "active": true,
      "createdAt": "2026-06-07T10:00:00Z"
    }
  ]
}
```

---

### Register a webhook

```
POST /api/webhooks
```

Registers a URL to receive POST requests when specified events occur.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | HTTPS endpoint to deliver events to |
| `events` | string[] | ✅ | Event names to subscribe to (see [Events](#events)) |

```json
{
  "url": "https://your-system.example.com/hooks/kanban",
  "events": ["ticket.created", "ticket.status_changed"]
}
```

Subscribe to all events using the wildcard:

```json
{
  "url": "https://your-system.example.com/hooks/kanban",
  "events": ["*"]
}
```

**Response 201**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "url": "https://your-system.example.com/hooks/kanban",
    "events": ["ticket.created", "ticket.status_changed"],
    "active": true,
    "createdAt": "2026-06-07T10:00:00Z"
  }
}
```

**Response 400** — missing url, empty events array, invalid URL format, or unknown event name

---

### Delete a webhook

```
DELETE /api/webhooks/:id
```

Permanently removes a webhook registration.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Webhook ID |

**Response 200**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "url": "https://your-system.example.com/hooks/kanban",
    "events": ["*"],
    "active": true,
    "createdAt": "2026-06-07T10:00:00Z"
  }
}
```

**Response 400** — non-numeric id  
**Response 404** — webhook not found

---

## Events

These are the event names you can subscribe to when registering a webhook.

| Event | Triggered when |
|-------|---------------|
| `ticket.created` | A ticket is created (via API or the kanban UI) |
| `ticket.updated` | A ticket field changes (title, priority, assignee, due date, etc.) |
| `ticket.status_changed` | A ticket moves to a different column |
| `ticket.comment_added` | A comment is posted on a ticket |
| `*` | Wildcard — matches all of the above |

### Delivery payload

Every webhook POST has this shape:

```json
{
  "event": "ticket.created",
  "timestamp": "2026-06-07T11:30:00Z",
  "data": { }
}
```

The `data` field contains the ticket object (for ticket events) or `{ ticketId, comment }` (for `ticket.comment_added`).

### Delivery behaviour

- **Fire-and-forget** — the kanban system does not wait for your endpoint to respond
- **No retries** — if your endpoint is down, the event is lost
- **Timeout** — standard `fetch()` timeout applies (~30s)
- Only webhooks with `active: true` receive events

---

## Error responses

All error responses follow the same shape:

```json
{
  "success": false,
  "error": "Human-readable description"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — invalid input or missing required fields |
| `404` | Resource not found |
| `500` | Server error |

---

## Quick-start example

**1. Register your webhook**

```bash
curl -X POST https://your-kanban-host/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-system.example.com/hooks/kanban","events":["*"]}'
```

**2. Create a ticket**

```bash
curl -X POST https://your-kanban-host/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Graffiti on Bridge St","priority":"low","department":"Streetworks"}'
```

**3. Your endpoint receives**

```json
{
  "event": "ticket.created",
  "timestamp": "2026-06-07T11:30:00Z",
  "data": {
    "id": 18,
    "ref": "LCI-018",
    "title": "Graffiti on Bridge St",
    "status": "new",
    "priority": "low",
    "department": "Streetworks"
  }
}
```
