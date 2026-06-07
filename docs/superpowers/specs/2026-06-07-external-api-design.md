# External API Design

**Date:** 2026-06-07  
**Status:** Approved  
**Project:** london-council-kanban

---

## Goal

Expose a REST API so external systems can create tickets and receive event notifications. Three consumers:

1. Council systems (CRM, case management, helpdesks) pushing tickets in server-to-server
2. A client-facing app where citizens or staff submit tickets
3. Webhook subscribers that need to react when tickets change

Authentication is deferred — endpoints are unauthenticated for now, designed so auth middleware can be added per-route without restructuring.

---

## API Surface

### Inbound (ticket creation + reads)

| Method | Route | Body / Query | Description |
|--------|-------|-------------|-------------|
| `POST` | `/api/tickets` | JSON: `title`, `priority`, `department` (required); `description`, `assigneeId`, `dueDate` (optional) | Create a ticket. Returns the created ticket. |
| `GET` | `/api/tickets` | Query: `status`, `department`, `priority` (all optional) | List tickets, filterable. Returns array of tickets. |
| `GET` | `/api/tickets/[id]` | — | Single ticket with comments and activity log. |

The existing `PATCH /api/tickets` is unchanged (drag-and-drop column moves).

### Webhook Registry

| Method | Route | Body | Description |
|--------|-------|------|-------------|
| `POST` | `/api/webhooks` | JSON: `url` (required), `events` (required, string array) | Register a webhook. |
| `GET` | `/api/webhooks` | — | List all active webhooks. |
| `DELETE` | `/api/webhooks/[id]` | — | Remove a webhook by id. |

---

## Webhook Events

| Event | Triggered when |
|-------|---------------|
| `ticket.created` | A ticket is created via API or UI |
| `ticket.updated` | Any ticket field changes (title, priority, assignee, due date, etc.) |
| `ticket.status_changed` | Ticket moves to a different column |
| `ticket.comment_added` | A comment is posted on a ticket |

When registering, callers supply an `events` array — e.g. `["ticket.created", "ticket.status_changed"]` — or `["*"]` to subscribe to all events.

### Delivery Payload

```json
{
  "event": "ticket.created",
  "timestamp": "2026-06-07T09:15:00Z",
  "data": {
    "id": 42,
    "ref": "LCI-042",
    "title": "Pothole on High Street",
    "status": "new",
    "priority": "high",
    "department": "Highways"
  }
}
```

### Delivery Behaviour

- Fire-and-forget: `fetch()` POST to each matching URL, not awaited
- No retry on failure — the caller gets `200` immediately
- Matching: a webhook matches if its `events` array contains the event name or `"*"`
- Only `active = true` webhooks are queried

---

## Database Changes

### New table: `webhooks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `url` | text, not null | Delivery target URL |
| `events` | text[], not null | Subscribed events, e.g. `["ticket.created"]` or `["*"]` |
| `active` | boolean, default true | Soft-disable without deleting |
| `createdAt` | timestamp | Auto-set on insert |

No changes to existing tables.

---

## Architecture

### `lib/webhooks.ts` — delivery helper

```typescript
export async function fireWebhooks(event: WebhookEvent, data: unknown): Promise<void>
```

- Queries `webhooks` table for `active = true` rows where `events` contains `event` or `"*"`
- Fans out `fetch()` POST to each matched URL — no `await` on the fetch calls
- Called from server actions and API route handlers

### Dispatch points

| Location | Events fired |
|----------|-------------|
| `lib/actions.ts` — `createTicket` | `ticket.created` |
| `lib/actions.ts` — `updateTicket` (status change) | `ticket.status_changed` |
| `lib/actions.ts` — `updateTicket` (other fields) | `ticket.updated` |
| `lib/actions.ts` — `addComment` | `ticket.comment_added` |
| `app/api/tickets/route.ts` — `POST` handler | `ticket.created` |
| `app/api/tickets/route.ts` — `PATCH` handler | `ticket.status_changed` |

---

## Files

### New

```
app/api/tickets/[id]/route.ts        GET /api/tickets/[id]
app/api/webhooks/route.ts            GET + POST /api/webhooks
app/api/webhooks/[id]/route.ts       DELETE /api/webhooks/[id]
lib/webhooks.ts                      fireWebhooks() helper + WebhookEvent type
db/migrations/XXXX_add_webhooks.sql  Schema migration for webhooks table
```

### Modified

```
app/api/tickets/route.ts    Add GET + POST handlers alongside existing PATCH
db/schema.ts                Add webhooks table definition
lib/actions.ts              Call fireWebhooks() from createTicket, updateTicket, addComment
```

### Shared DB logic

The `createTicket` server action and the `POST /api/tickets` route share the same insert transaction logic. To avoid duplication, the core DB work (insert ticket, insert boardOrder, insert activityLog, return created ticket) is extracted into a `lib/db/tickets.ts` helper. Both callers invoke this helper, then fire the webhook independently. The server action continues to accept `FormData`; the API route accepts JSON and maps to the same helper.

---

## Response Format

All endpoints follow the project's standard envelope:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

Error status codes: `400` (bad input), `404` (not found), `500` (server error).

---

## Out of Scope (this iteration)

- Authentication / API keys
- Webhook delivery logs or retry queue
- Webhook signature verification (HMAC)
- Rate limiting
- Pagination on `GET /api/tickets`
