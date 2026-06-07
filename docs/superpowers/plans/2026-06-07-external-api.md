# External API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose REST endpoints so external services can create tickets, read ticket data, and receive event webhooks when tickets change.

**Architecture:** Extract shared ticket-creation DB logic into `lib/db/tickets.ts`, build a fire-and-forget webhook delivery helper in `lib/webhooks.ts` backed by a new `webhooks` Postgres table, add REST handlers to existing and new Next.js API route files, and wire webhook dispatch into both server actions and API routes.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (postgres-js), PostgreSQL, Jest (`@jest-environment node`), TypeScript

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `db/schema.ts` | Modify | Add `webhooks` table + `Webhook` type |
| `lib/db/tickets.ts` | Create | `createTicketRecord()` shared DB helper |
| `lib/db/__tests__/tickets.test.ts` | Create | Unit tests for above |
| `lib/webhooks.ts` | Create | `fireWebhooks()` + `WebhookEvent` type |
| `lib/__tests__/webhooks.test.ts` | Create | Unit tests for above |
| `app/api/tickets/route.ts` | Modify | Add `GET` + `POST` alongside existing `PATCH` |
| `app/api/tickets/__tests__/route.test.ts` | Modify | Update mocks; add GET + POST tests |
| `app/api/tickets/[id]/route.ts` | Create | `GET /api/tickets/[id]` |
| `app/api/tickets/[id]/__tests__/route.test.ts` | Create | Tests |
| `app/api/webhooks/route.ts` | Create | `GET` + `POST /api/webhooks` |
| `app/api/webhooks/__tests__/route.test.ts` | Create | Tests |
| `app/api/webhooks/[id]/route.ts` | Create | `DELETE /api/webhooks/[id]` |
| `app/api/webhooks/[id]/__tests__/route.test.ts` | Create | Tests |
| `lib/actions.ts` | Modify | Import `createTicketRecord`; call `fireWebhooks` |

---

## Task 1: Add webhooks table to schema and migrate

**Files:**
- Modify: `db/schema.ts`

- [ ] **Step 1: Update db/schema.ts**

Add `boolean` to the import line and append the table + type at the bottom:

```typescript
import {
  pgTable, pgEnum, serial, text, integer, date, timestamp, boolean
} from 'drizzle-orm/pg-core'

// ... all existing code unchanged ...

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  events: text('events').array().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Webhook = typeof webhooks.$inferSelect
```

- [ ] **Step 2: Generate migration**

```bash
npm run db:generate
```

Expected: a new SQL file appears in `db/migrations/`.

- [ ] **Step 3: Run migration**

```bash
npm run db:migrate
```

Expected: Drizzle reports all migrations applied with no errors.

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts db/migrations/
git commit -m "✨feat: add webhooks table to schema"
```

---

## Task 2: Extract createTicketRecord into lib/db/tickets.ts

**Files:**
- Create: `lib/db/__tests__/tickets.test.ts`
- Create: `lib/db/tickets.ts`
- Modify: `lib/actions.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/db/__tests__/tickets.test.ts`:

```typescript
/**
 * @jest-environment node
 */

const mockTicket = {
  id: 1, ref: 'LCI-001', title: 'Fix pothole', status: 'new',
  priority: 'medium', department: 'Highways', description: null,
  assigneeId: null, dueDate: null, createdAt: new Date(), updatedAt: new Date(),
}

jest.mock('@/db', () => ({
  db: { transaction: jest.fn().mockResolvedValue(mockTicket) },
}))
jest.mock('@/db/schema', () => ({
  tickets: 'tickets', boardOrder: 'boardOrder', activityLog: 'activityLog',
}))
jest.mock('drizzle-orm', () => ({ max: jest.fn() }))

describe('createTicketRecord', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls db.transaction and returns the created ticket', async () => {
    const { db } = await import('@/db')
    const { createTicketRecord } = await import('../tickets')

    const result = await createTicketRecord({
      title: 'Fix pothole',
      priority: 'medium',
      department: 'Highways',
    })

    expect(db.transaction).toHaveBeenCalled()
    expect(result).toEqual(mockTicket)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/db/__tests__/tickets.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../tickets'`

- [ ] **Step 3: Implement createTicketRecord**

Create `lib/db/tickets.ts`:

```typescript
import { db } from '@/db'
import { tickets, boardOrder, activityLog } from '@/db/schema'
import { max } from 'drizzle-orm'
import type { TicketPriority, Ticket } from '@/db/schema'

export interface CreateTicketInput {
  title: string
  description?: string | null
  priority: TicketPriority
  department: string
  assigneeId?: number | null
  dueDate?: string | null
}

export async function createTicketRecord(input: CreateTicketInput): Promise<Ticket> {
  return db.transaction(async (tx) => {
    const [{ maxNum }] = await tx.select({ maxNum: max(tickets.id) }).from(tickets)
    const nextNum = (maxNum ?? 0) + 1
    const ref = `LCI-${String(nextNum).padStart(3, '0')}`

    const [created] = await tx.insert(tickets).values({
      ref,
      title: input.title.trim(),
      description: input.description ?? null,
      priority: input.priority,
      department: input.department,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
      status: 'new',
    }).returning()

    const [{ maxPos }] = await tx.select({ maxPos: max(boardOrder.position) }).from(boardOrder)
    await tx.insert(boardOrder).values({ ticketId: created.id, position: (maxPos ?? -1) + 1 })

    await tx.insert(activityLog).values({
      ticketId: created.id,
      action: 'created',
      actorName: 'Council Officer',
    })

    return created
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/db/__tests__/tickets.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Update lib/actions.ts to use createTicketRecord**

Replace the entire file content:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tickets, comments, activityLog, teamMembers } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { TicketStatus, TicketPriority } from '@/db/schema'
import { createTicketRecord } from '@/lib/db/tickets'

export async function createTicket(formData: FormData) {
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const priority = formData.get('priority') as TicketPriority
  const department = formData.get('department') as string
  const assigneeId = formData.get('assigneeId') ? Number(formData.get('assigneeId')) : null
  const dueDate = (formData.get('dueDate') as string) || null

  if (!title?.trim() || !priority || !department) {
    throw new Error('title, priority, and department are required')
  }

  await createTicketRecord({ title, description, priority, department, assigneeId, dueDate })

  revalidatePath('/')
  revalidatePath('/board')
}

export async function updateTicket(ticketId: number, updates: {
  title?: string
  description?: string | null
  priority?: TicketPriority
  department?: string
  assigneeId?: number | null
  dueDate?: string | null
  status?: TicketStatus
}) {
  const [ticket] = await db.update(tickets)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
    .returning()

  if (updates.status) {
    await db.insert(activityLog).values({
      ticketId,
      action: `moved to ${updates.status.replace('_', ' ')}`,
      actorName: 'Council Officer',
    })
  }

  revalidatePath('/')
  revalidatePath('/board')
  return ticket
}

export async function addComment(ticketId: number, body: string) {
  const [comment] = await db.insert(comments).values({
    ticketId, authorName: 'Council Officer', body,
  }).returning()

  await db.insert(activityLog).values({
    ticketId, action: 'added a comment', actorName: 'Council Officer',
  })

  revalidatePath('/board')
  return comment
}

export async function getTicketWithDetails(ticketId: number) {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId))
  if (!ticket) return null

  const [ticketComments, activity, allMembers] = await Promise.all([
    db.select().from(comments).where(eq(comments.ticketId, ticketId)),
    db.select().from(activityLog).where(eq(activityLog.ticketId, ticketId))
      .orderBy(desc(activityLog.createdAt)),
    db.select().from(teamMembers),
  ])

  const assignee = ticket.assigneeId
    ? allMembers.find(m => m.id === ticket.assigneeId) ?? null
    : null

  return { ...ticket, comments: ticketComments, activity, assignee, allMembers }
}
```

- [ ] **Step 6: Verify all existing tests still pass**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/db/tickets.ts lib/db/__tests__/tickets.test.ts lib/actions.ts
git commit -m "✨feat: extract createTicketRecord into lib/db/tickets"
```

---

## Task 3: Add fireWebhooks helper

**Files:**
- Create: `lib/__tests__/webhooks.test.ts`
- Create: `lib/webhooks.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/webhooks.test.ts`:

```typescript
/**
 * @jest-environment node
 */

const mockWhere = jest.fn()
const mockFrom = jest.fn(() => ({ where: mockWhere }))

jest.mock('@/db', () => ({
  db: { select: () => ({ from: mockFrom }) },
}))
jest.mock('@/db/schema', () => ({ webhooks: 'webhooks_table' }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))

describe('fireWebhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)
  })

  it('POSTs to matching webhook URLs', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['ticket.created'], active: true },
    ])

    const { fireWebhooks } = await import('../webhooks')
    fireWebhooks('ticket.created', { id: 1, ref: 'LCI-001' })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.event).toBe('ticket.created')
    expect(body.data).toEqual({ id: 1, ref: 'LCI-001' })
  })

  it('does not POST for non-matching events', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['ticket.updated'], active: true },
    ])

    const { fireWebhooks } = await import('../webhooks')
    fireWebhooks('ticket.created', { id: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('matches wildcard "*" subscriptions', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['*'], active: true },
    ])

    const { fireWebhooks } = await import('../webhooks')
    fireWebhooks('ticket.comment_added', { id: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not throw when fetch fails', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['*'], active: true },
    ])
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { fireWebhooks } = await import('../webhooks')
    expect(() => fireWebhooks('ticket.created', {})).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/__tests__/webhooks.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../webhooks'`

- [ ] **Step 3: Implement fireWebhooks**

Create `lib/webhooks.ts`:

```typescript
import { db } from '@/db'
import { webhooks } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type WebhookEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.comment_added'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: unknown
}

export function fireWebhooks(event: WebhookEvent, data: unknown): void {
  void (async () => {
    try {
      const targets = await db.select().from(webhooks).where(eq(webhooks.active, true))
      const matching = targets.filter(
        (w) => w.events.includes(event) || w.events.includes('*')
      )
      const payload: WebhookPayload = { event, timestamp: new Date().toISOString(), data }
      for (const webhook of matching) {
        void fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Delivery failure is intentionally silent
        })
      }
    } catch {
      // Don't surface webhook errors to the caller
    }
  })()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/__tests__/webhooks.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/webhooks.ts lib/__tests__/webhooks.test.ts
git commit -m "✨feat: add fireWebhooks helper"
```

---

## Task 4: GET /api/tickets

**Files:**
- Modify: `app/api/tickets/__tests__/route.test.ts`
- Modify: `app/api/tickets/route.ts`

- [ ] **Step 1: Replace the test file with updated mocks and new GET tests**

Overwrite `app/api/tickets/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/db', () => ({ db: { transaction: jest.fn(), select: jest.fn(), update: jest.fn() } }))
jest.mock('@/db/schema', () => ({ tickets: {}, boardOrder: {}, webhooks: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), and: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/db/tickets', () => ({ createTicketRecord: jest.fn() }))
jest.mock('@/lib/webhooks', () => ({ fireWebhooks: jest.fn() }))

describe('PATCH /api/tickets', () => {
  it('returns 400 when body is missing required fields', async () => {
    const { PATCH } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId: 1 }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/tickets', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with ticket list when no filters', async () => {
    const mockTickets = [{ id: 1, ref: 'LCI-001', title: 'Test', status: 'new' }]
    const { db } = await import('@/db')
    ;(db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockResolvedValue(mockTickets),
    })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockTickets)
  })

  it('applies .where() when query params are present', async () => {
    const mockWhere = jest.fn().mockResolvedValue([])
    const { db } = await import('@/db')
    ;(db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ where: mockWhere }),
    })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets?status=new')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockWhere).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify GET tests fail**

```bash
npx jest app/api/tickets/__tests__/route.test.ts --no-coverage
```

Expected: PATCH test passes; GET tests FAIL — `GET is not a function`

- [ ] **Step 3: Rewrite app/api/tickets/route.ts with GET added**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tickets, boardOrder } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { TicketStatus, TicketPriority } from '@/db/schema'
import { createTicketRecord } from '@/lib/db/tickets'
import { fireWebhooks } from '@/lib/webhooks'

interface MovePayload {
  ticketId: number
  newStatus: TicketStatus
  positions: Array<{ ticketId: number; position: number }>
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as TicketStatus | null
  const department = searchParams.get('department')
  const priority = searchParams.get('priority') as TicketPriority | null

  const conditions = [
    status ? eq(tickets.status, status) : null,
    department ? eq(tickets.department, department) : null,
    priority ? eq(tickets.priority, priority) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const results = conditions.length > 0
    ? await db.select().from(tickets).where(and(...conditions))
    : await db.select().from(tickets)

  return NextResponse.json({ success: true, data: results })
}

export async function PATCH(request: NextRequest) {
  let body: MovePayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { ticketId, newStatus, positions } = body
  if (!ticketId || !newStatus || !Array.isArray(positions)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(tickets)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId))

      await Promise.all(
        positions.map(({ ticketId: tid, position }) =>
          tx.update(boardOrder).set({ position }).where(eq(boardOrder.ticketId, tid))
        )
      )
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }

  revalidatePath('/board')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx jest app/api/tickets/__tests__/route.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/tickets/route.ts app/api/tickets/__tests__/route.test.ts
git commit -m "✨feat: add GET /api/tickets"
```

---

## Task 5: POST /api/tickets

**Files:**
- Modify: `app/api/tickets/__tests__/route.test.ts`
- Modify: `app/api/tickets/route.ts`

- [ ] **Step 1: Add POST tests to the test file**

Append this describe block to `app/api/tickets/__tests__/route.test.ts`:

```typescript
describe('POST /api/tickets', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'No priority or dept' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 with created ticket on valid input', async () => {
    const mockTicket = { id: 2, ref: 'LCI-002', title: 'Road issue', status: 'new' }
    const { createTicketRecord } = await import('@/lib/db/tickets')
    ;(createTicketRecord as jest.Mock).mockResolvedValue(mockTicket)

    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'Road issue', priority: 'high', department: 'Highways' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockTicket)
  })
})
```

- [ ] **Step 2: Run tests to verify POST tests fail**

```bash
npx jest app/api/tickets/__tests__/route.test.ts --no-coverage
```

Expected: GET + PATCH tests pass; POST tests FAIL — `POST is not a function`

- [ ] **Step 3: Add POST handler to app/api/tickets/route.ts**

Insert after the GET handler (before PATCH):

```typescript
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, priority, department, description, assigneeId, dueDate } =
    body as Record<string, unknown>

  if (!title || typeof title !== 'string' || !priority || !department) {
    return NextResponse.json(
      { success: false, error: 'title, priority, and department are required' },
      { status: 400 }
    )
  }

  try {
    const ticket = await createTicketRecord({
      title,
      priority: priority as TicketPriority,
      department: department as string,
      description: (description as string) ?? null,
      assigneeId: (assigneeId as number) ?? null,
      dueDate: (dueDate as string) ?? null,
    })
    revalidatePath('/')
    revalidatePath('/board')
    fireWebhooks('ticket.created', ticket)
    return NextResponse.json({ success: true, data: ticket }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create ticket' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npx jest app/api/tickets/__tests__/route.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/tickets/route.ts app/api/tickets/__tests__/route.test.ts
git commit -m "✨feat: add POST /api/tickets"
```

---

## Task 6: GET /api/tickets/[id]

**Files:**
- Create: `app/api/tickets/[id]/__tests__/route.test.ts`
- Create: `app/api/tickets/[id]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/tickets/[id]/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockSelect = jest.fn()

jest.mock('@/db', () => ({ db: { select: mockSelect } }))
jest.mock('@/db/schema', () => ({
  tickets: {}, comments: {}, activityLog: {}, teamMembers: {},
}))
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), desc: jest.fn() }))

describe('GET /api/tickets/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 for non-numeric id', async () => {
    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets/abc')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when ticket does not exist', async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
    })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets/999')
    const res = await GET(req, { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with ticket details when found', async () => {
    const mockTicket = { id: 1, ref: 'LCI-001', title: 'Test', assigneeId: null }
    const mockComments = [{ id: 1, body: 'A comment' }]

    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockTicket]) }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(mockComments) }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ orderBy: jest.fn().mockResolvedValue([]) }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([]),
      })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.ref).toBe('LCI-001')
    expect(body.data.comments).toEqual(mockComments)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest "app/api/tickets/\[id\]/__tests__/route.test.ts" --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `app/api/tickets/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { tickets, comments, activityLog, teamMembers } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ticketId = parseInt(id, 10)
  if (isNaN(ticketId)) {
    return NextResponse.json({ success: false, error: 'Invalid ticket id' }, { status: 400 })
  }

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId))
  if (!ticket) {
    return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
  }

  const [ticketComments, activity, allMembers] = await Promise.all([
    db.select().from(comments).where(eq(comments.ticketId, ticketId)),
    db.select().from(activityLog)
      .where(eq(activityLog.ticketId, ticketId))
      .orderBy(desc(activityLog.createdAt)),
    db.select().from(teamMembers),
  ])

  const assignee = ticket.assigneeId
    ? allMembers.find((m) => m.id === ticket.assigneeId) ?? null
    : null

  return NextResponse.json({
    success: true,
    data: { ...ticket, comments: ticketComments, activity, assignee },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest "app/api/tickets/\[id\]/__tests__/route.test.ts" --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/tickets/[id]/route.ts" "app/api/tickets/[id]/__tests__/route.test.ts"
git commit -m "✨feat: add GET /api/tickets/[id]"
```

---

## Task 7: Webhook registry — POST + GET /api/webhooks

**Files:**
- Create: `app/api/webhooks/__tests__/route.test.ts`
- Create: `app/api/webhooks/route.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/webhooks/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockReturning = jest.fn()
const mockValues = jest.fn(() => ({ returning: mockReturning }))
const mockInsert = jest.fn(() => ({ values: mockValues }))
const mockWhere = jest.fn()
const mockFrom = jest.fn(() => ({ where: mockWhere }))
const mockSelect = jest.fn(() => ({ from: mockFrom }))

jest.mock('@/db', () => ({ db: { select: mockSelect, insert: mockInsert } }))
jest.mock('@/db/schema', () => ({ webhooks: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))

describe('GET /api/webhooks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with list of active webhooks', async () => {
    const mockHooks = [{ id: 1, url: 'https://example.com', events: ['*'], active: true }]
    mockWhere.mockResolvedValue(mockHooks)

    const { GET } = await import('../route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockHooks)
  })
})

describe('POST /api/webhooks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when url is missing', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ events: ['ticket.created'] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 400 when events array is empty', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', events: [] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 400 for an invalid URL format', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url', events: ['*'] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 400 for unknown event names', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', events: ['ticket.deleted'] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 201 with created webhook on valid input', async () => {
    const mockHook = { id: 1, url: 'https://example.com', events: ['*'], active: true }
    mockReturning.mockResolvedValue([mockHook])

    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', events: ['*'] }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockHook)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/webhooks/__tests__/route.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `app/api/webhooks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhooks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { WebhookEvent } from '@/lib/webhooks'

const VALID_EVENTS: Array<WebhookEvent | '*'> = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.comment_added',
  '*',
]

export async function GET() {
  const results = await db.select().from(webhooks).where(eq(webhooks.active, true))
  return NextResponse.json({ success: true, data: results })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, events } = body as Record<string, unknown>

  if (!url || typeof url !== 'string' || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { success: false, error: 'url and events (non-empty array) are required' },
      { status: 400 }
    )
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 })
  }

  const invalid = (events as unknown[]).filter((e) => !VALID_EVENTS.includes(e as WebhookEvent))
  if (invalid.length > 0) {
    return NextResponse.json(
      { success: false, error: `Invalid events: ${invalid.join(', ')}` },
      { status: 400 }
    )
  }

  const [created] = await db.insert(webhooks).values({ url, events: events as string[] }).returning()
  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest app/api/webhooks/__tests__/route.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/route.ts app/api/webhooks/__tests__/route.test.ts
git commit -m "✨feat: add GET + POST /api/webhooks"
```

---

## Task 8: DELETE /api/webhooks/[id]

**Files:**
- Create: `app/api/webhooks/[id]/__tests__/route.test.ts`
- Create: `app/api/webhooks/[id]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/webhooks/[id]/__tests__/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockReturning = jest.fn()
const mockWhere = jest.fn(() => ({ returning: mockReturning }))
const mockDelete = jest.fn(() => ({ where: mockWhere }))

jest.mock('@/db', () => ({ db: { delete: mockDelete } }))
jest.mock('@/db/schema', () => ({ webhooks: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))

describe('DELETE /api/webhooks/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 for a non-numeric id', async () => {
    const { DELETE } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/abc', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the webhook does not exist', async () => {
    mockReturning.mockResolvedValue([])
    const { DELETE } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/999', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with the deleted webhook', async () => {
    const mockHook = { id: 1, url: 'https://example.com', events: ['*'], active: true }
    mockReturning.mockResolvedValue([mockHook])

    const { DELETE } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockHook)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest "app/api/webhooks/\[id\]/__tests__/route.test.ts" --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `app/api/webhooks/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhooks } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const webhookId = parseInt(id, 10)
  if (isNaN(webhookId)) {
    return NextResponse.json({ success: false, error: 'Invalid webhook id' }, { status: 400 })
  }

  const [deleted] = await db.delete(webhooks).where(eq(webhooks.id, webhookId)).returning()
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: deleted })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest "app/api/webhooks/\[id\]/__tests__/route.test.ts" --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/webhooks/[id]/route.ts" "app/api/webhooks/[id]/__tests__/route.test.ts"
git commit -m "✨feat: add DELETE /api/webhooks/[id]"
```

---

## Task 9: Wire webhooks into lib/actions.ts

**Files:**
- Modify: `lib/actions.ts`

- [ ] **Step 1: Update lib/actions.ts**

Replace the full file content with (adds `fireWebhooks` calls after each mutation):

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tickets, comments, activityLog, teamMembers } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { TicketStatus, TicketPriority } from '@/db/schema'
import { createTicketRecord } from '@/lib/db/tickets'
import { fireWebhooks } from '@/lib/webhooks'

export async function createTicket(formData: FormData) {
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const priority = formData.get('priority') as TicketPriority
  const department = formData.get('department') as string
  const assigneeId = formData.get('assigneeId') ? Number(formData.get('assigneeId')) : null
  const dueDate = (formData.get('dueDate') as string) || null

  if (!title?.trim() || !priority || !department) {
    throw new Error('title, priority, and department are required')
  }

  const ticket = await createTicketRecord({ title, description, priority, department, assigneeId, dueDate })
  fireWebhooks('ticket.created', ticket)

  revalidatePath('/')
  revalidatePath('/board')
}

export async function updateTicket(ticketId: number, updates: {
  title?: string
  description?: string | null
  priority?: TicketPriority
  department?: string
  assigneeId?: number | null
  dueDate?: string | null
  status?: TicketStatus
}) {
  const [ticket] = await db.update(tickets)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))
    .returning()

  if (updates.status) {
    await db.insert(activityLog).values({
      ticketId,
      action: `moved to ${updates.status.replace('_', ' ')}`,
      actorName: 'Council Officer',
    })
    fireWebhooks('ticket.status_changed', ticket)
  } else {
    fireWebhooks('ticket.updated', ticket)
  }

  revalidatePath('/')
  revalidatePath('/board')
  return ticket
}

export async function addComment(ticketId: number, body: string) {
  const [comment] = await db.insert(comments).values({
    ticketId, authorName: 'Council Officer', body,
  }).returning()

  await db.insert(activityLog).values({
    ticketId, action: 'added a comment', actorName: 'Council Officer',
  })

  fireWebhooks('ticket.comment_added', { ticketId, comment })

  revalidatePath('/board')
  return comment
}

export async function getTicketWithDetails(ticketId: number) {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId))
  if (!ticket) return null

  const [ticketComments, activity, allMembers] = await Promise.all([
    db.select().from(comments).where(eq(comments.ticketId, ticketId)),
    db.select().from(activityLog).where(eq(activityLog.ticketId, ticketId))
      .orderBy(desc(activityLog.createdAt)),
    db.select().from(teamMembers),
  ])

  const assignee = ticket.assigneeId
    ? allMembers.find(m => m.id === ticket.assigneeId) ?? null
    : null

  return { ...ticket, comments: ticketComments, activity, assignee, allMembers }
}
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/actions.ts
git commit -m "✨feat: fire webhooks from server actions"
```

---

## Task 10: Wire webhooks into PATCH /api/tickets + final build check

**Files:**
- Modify: `app/api/tickets/route.ts`
- Modify: `app/api/tickets/__tests__/route.test.ts`

- [ ] **Step 1: Add PATCH webhook test**

Append to `describe('PATCH /api/tickets')` in `app/api/tickets/__tests__/route.test.ts`:

```typescript
it('calls fireWebhooks with ticket.status_changed on success', async () => {
  const { db } = await import('@/db')
  ;(db.transaction as jest.Mock).mockResolvedValue(undefined)

  const { fireWebhooks } = await import('@/lib/webhooks')
  const { PATCH } = await import('../route')

  const req = new NextRequest('http://localhost/api/tickets', {
    method: 'PATCH',
    body: JSON.stringify({
      ticketId: 1,
      newStatus: 'in_progress',
      positions: [{ ticketId: 1, position: 0 }],
    }),
  })
  await PATCH(req)

  expect(fireWebhooks).toHaveBeenCalledWith(
    'ticket.status_changed',
    { ticketId: 1, newStatus: 'in_progress' }
  )
})
```

- [ ] **Step 2: Run tests to verify the new PATCH test fails**

```bash
npx jest app/api/tickets/__tests__/route.test.ts --no-coverage
```

Expected: new PATCH test FAIL — `fireWebhooks` not called yet

- [ ] **Step 3: Add fireWebhooks call to the PATCH handler in app/api/tickets/route.ts**

After the `try/catch` block (before `revalidatePath`), add:

```typescript
  fireWebhooks('ticket.status_changed', { ticketId, newStatus })
  revalidatePath('/board')
  return NextResponse.json({ success: true })
```

The full updated PATCH handler:

```typescript
export async function PATCH(request: NextRequest) {
  let body: MovePayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { ticketId, newStatus, positions } = body
  if (!ticketId || !newStatus || !Array.isArray(positions)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(tickets)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId))

      await Promise.all(
        positions.map(({ ticketId: tid, position }) =>
          tx.update(boardOrder).set({ position }).where(eq(boardOrder.ticketId, tid))
        )
      )
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }

  fireWebhooks('ticket.status_changed', { ticketId, newStatus })
  revalidatePath('/board')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/tickets/route.ts app/api/tickets/__tests__/route.test.ts
git commit -m "✨feat: fire ticket.status_changed webhook from PATCH /api/tickets"
```

---

## Summary of Endpoints Delivered

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/tickets` | List tickets (filter by `status`, `department`, `priority`) |
| `POST` | `/api/tickets` | Create ticket — fires `ticket.created` webhook |
| `GET` | `/api/tickets/[id]` | Single ticket with comments + activity |
| `PATCH` | `/api/tickets` | Move ticket column — fires `ticket.status_changed` webhook |
| `POST` | `/api/webhooks` | Register a webhook URL + event subscriptions |
| `GET` | `/api/webhooks` | List active webhooks |
| `DELETE` | `/api/webhooks/[id]` | Remove a webhook |
