# London Council Kanban — Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the London Council kanban board from `kanban-v2-2.html` into a Next.js 15 App Router app backed by PostgreSQL via Drizzle ORM.

**Architecture:** Server Components fetch data directly from Postgres on each page load; mutations use Server Actions; drag-and-drop reordering uses a single `PATCH /api/tickets` route because it fires from a client drag handler needing to batch position updates. After any mutation, `router.refresh()` re-syncs the UI.

**Tech Stack:** Next.js 15 (App Router), PostgreSQL 16 (Docker), Drizzle ORM + drizzle-kit, CSS Modules, native HTML5 drag API, Jest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `docker-compose.yml` | Create | Postgres 16 service on port 5432 |
| `.env.local` | Create | DATABASE_URL (gitignored) |
| `drizzle.config.ts` | Create | drizzle-kit config |
| `db/schema.ts` | Create | All table + enum definitions |
| `db/index.ts` | Create | Drizzle client singleton |
| `db/seed.ts` | Create | 16 tickets + 5 team members |
| `lib/actions.ts` | Create | Server Actions: createTicket, updateTicket, addComment, getTicketWithDetails |
| `app/api/tickets/route.ts` | Create | PATCH handler for drag-drop reorder |
| `app/globals.css` | Replace | Design tokens + reset + shell layout |
| `app/layout.tsx` | Replace | Root layout with sidebar |
| `app/page.tsx` | Replace | Dashboard Server Component |
| `app/board/page.tsx` | Create | Board Server Component |
| `components/sidebar.tsx` | Create | Fixed nav sidebar |
| `components/sidebar.module.css` | Create | Sidebar styles |
| `components/dashboard/stat-cards.tsx` | Create | 4 KPI cards |
| `components/dashboard/stat-cards.module.css` | Create | |
| `components/dashboard/recent-tickets.tsx` | Create | Latest 5 tickets table |
| `components/dashboard/recent-tickets.module.css` | Create | |
| `components/dashboard/dept-breakdown.tsx` | Create | Ticket count by department |
| `components/dashboard/dept-breakdown.module.css` | Create | |
| `components/dashboard/activity-feed.tsx` | Create | Recent activity log |
| `components/dashboard/activity-feed.module.css` | Create | |
| `components/board/ticket-card.tsx` | Create | Draggable card (client) |
| `components/board/ticket-card.module.css` | Create | |
| `components/board/column.tsx` | Create | Drop target column (client) |
| `components/board/column.module.css` | Create | |
| `components/board/kanban-board.tsx` | Create | Client component owning drag state + filter |
| `components/board/kanban-board.module.css` | Create | |
| `components/ticket-detail.tsx` | Create | Slide-in detail panel (client) |
| `components/ticket-detail.module.css` | Create | |
| `components/create-ticket-modal.tsx` | Create | Create ticket modal (client) |
| `components/create-ticket-modal.module.css` | Create | |
| `jest.config.ts` | Create | Jest + Next.js config |
| `jest.setup.ts` | Create | Testing Library setup |

---

## Task 1: Bootstrap Next.js Project

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold the app**

Run in `/Users/yvette/projects/london-council-kanban`:
```bash
npx create-next-app@15 . --typescript --eslint=false --tailwind=false --app --src-dir=false --import-alias="@/*" --yes
```
When prompted about existing files, choose to proceed (it won't touch `docs/`).

- [ ] **Step 2: Install additional dependencies**

```bash
npm install drizzle-orm postgres dotenv
npm install -D drizzle-kit tsx @types/pg jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 3: Remove create-next-app boilerplate**

```bash
rm -rf app/fonts public/next.svg public/vercel.svg
# Delete contents of app/page.tsx and app/globals.css — we'll replace them in later tasks
```

- [ ] **Step 4: Update package.json scripts**

Open `package.json` and replace the `"scripts"` section with:
```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx db/seed.ts",
  "test": "jest",
  "test:watch": "jest --watch"
}
```

- [ ] **Step 5: Create jest.config.ts**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/*.test.ts?(x)'],
}

export default createJestConfig(config)
```

- [ ] **Step 6: Create jest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Run tests to verify setup**

```bash
npx jest --passWithNoTests
```
Expected: `Test Suites: 0 passed`

- [ ] **Step 8: Commit**

```bash
git init
git add package.json package-lock.json jest.config.ts jest.setup.ts next.config.ts tsconfig.json .gitignore
git commit -m "✨feat: bootstrap Next.js 15 project with Jest"
```

---

## Task 2: Docker + Environment + Drizzle Config

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.local`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: london_kanban
      POSTGRES_USER: kanban
      POSTGRES_PASSWORD: kanban
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Create .env.local**

```
DATABASE_URL=postgresql://kanban:kanban@localhost:5432/london_kanban
```

Add `.env.local` to `.gitignore` if not already there.

- [ ] **Step 3: Create drizzle.config.ts**

```typescript
import 'dotenv/config'
import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

- [ ] **Step 4: Start Postgres**

```bash
docker compose up -d
```
Expected: container starts, `docker compose ps` shows `postgres` running.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml drizzle.config.ts .gitignore
git commit -m "✨feat: add Docker Postgres and Drizzle config"
```

---

## Task 3: Database Schema

**Files:**
- Create: `db/schema.ts`

- [ ] **Step 1: Create db/schema.ts**

```typescript
import {
  pgTable, pgEnum, serial, text, integer, date, timestamp
} from 'drizzle-orm/pg-core'

export const statusEnum = pgEnum('ticket_status', [
  'new', 'review', 'in_progress', 'escalated', 'resolved', 'awaiting',
])

export const priorityEnum = pgEnum('ticket_priority', ['high', 'medium', 'low'])

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
})

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  ref: text('ref').unique().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: statusEnum('status').notNull().default('new'),
  priority: priorityEnum('priority').notNull().default('medium'),
  department: text('department').notNull(),
  assigneeId: integer('assignee_id').references(() => teamMembers.id),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  action: text('action').notNull(),
  actorName: text('actor_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const boardOrder = pgTable('board_order', {
  ticketId: integer('ticket_id').primaryKey().references(() => tickets.id),
  position: integer('position').notNull(),
})

export type TicketStatus = typeof statusEnum.enumValues[number]
export type TicketPriority = typeof priorityEnum.enumValues[number]
export type Ticket = typeof tickets.$inferSelect
export type TeamMember = typeof teamMembers.$inferSelect
export type Comment = typeof comments.$inferSelect
export type ActivityEntry = typeof activityLog.$inferSelect
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add db/schema.ts
git commit -m "✨feat: add Drizzle schema — 5 tables, status/priority enums"
```

---

## Task 4: DB Client + Migrations + Seed

**Files:**
- Create: `db/index.ts`
- Create: `db/seed.ts`

- [ ] **Step 1: Create db/index.ts**

```typescript
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

- [ ] **Step 2: Generate and run migrations**

```bash
npm run db:generate
npm run db:migrate
```
Expected: `db/migrations/` folder created, migration applied, tables exist in Postgres.

Verify:
```bash
docker exec -it $(docker compose ps -q postgres) psql -U kanban -d london_kanban -c "\dt"
```
Expected: 5 tables listed.

- [ ] **Step 3: Create db/seed.ts**

```typescript
import 'dotenv/config'
import { db } from './index'
import { teamMembers, tickets, boardOrder, activityLog, comments } from './schema'

const memberData = [
  { name: 'Sarah Chen', role: 'Housing Officer', initials: 'SC', color: '#4F7CFF' },
  { name: 'Marcus Johnson', role: 'Highways Inspector', initials: 'MJ', color: '#22C55E' },
  { name: 'Priya Patel', role: 'Planning Officer', initials: 'PP', color: '#F59E0B' },
  { name: 'Tom Walsh', role: 'Environmental Officer', initials: 'TW', color: '#EF4444' },
  { name: 'Lisa Kim', role: 'Parks Manager', initials: 'LK', color: '#8B5CF6' },
]

async function seed() {
  // Clear in FK-safe order
  await db.delete(activityLog)
  await db.delete(boardOrder)
  await db.delete(comments)
  await db.delete(tickets)
  await db.delete(teamMembers)

  const members = await db.insert(teamMembers).values(memberData).returning()
  const [sarah, marcus, priya, tom, lisa] = members

  const ticketData = [
    { ref: 'LCI-001', title: 'Pothole on Thornton Road causing vehicle damage', status: 'in_progress' as const, priority: 'high' as const, department: 'Highways', assigneeId: marcus.id, dueDate: '2026-06-15', description: 'Large pothole approx 30cm wide at junction with Maple Ave. Three vehicle damage reports received.' },
    { ref: 'LCI-002', title: 'Street lighting fault — Station Road (3 lamps out)', status: 'new' as const, priority: 'medium' as const, department: 'Highways', assigneeId: marcus.id, dueDate: '2026-06-20', description: null },
    { ref: 'LCI-003', title: 'Overgrown hedges blocking pavement on Elm Avenue', status: 'review' as const, priority: 'low' as const, department: 'Parks', assigneeId: lisa.id, dueDate: null, description: 'Resident complaint — hedge overhangs pavement forcing pedestrians into road.' },
    { ref: 'LCI-004', title: 'Housing benefit dispute — 14A Maple Close', status: 'escalated' as const, priority: 'high' as const, department: 'Housing', assigneeId: sarah.id, dueDate: '2026-06-10', description: 'Resident disputes benefit reduction decision. Legal representation involved.' },
    { ref: 'LCI-005', title: 'Fly-tipping behind Tesco Express, High Street', status: 'new' as const, priority: 'high' as const, department: 'Environmental Services', assigneeId: tom.id, dueDate: '2026-06-12', description: 'Large pile of household waste and furniture. Photos taken 2026-06-05.' },
    { ref: 'LCI-006', title: 'Planning application review — 22 Church Lane extension', status: 'review' as const, priority: 'medium' as const, department: 'Planning', assigneeId: priya.id, dueDate: '2026-06-25', description: 'Two-storey side extension proposal. Neighbour objections received.' },
    { ref: 'LCI-007', title: 'Noise complaint — Flat 3B Carlton House', status: 'in_progress' as const, priority: 'medium' as const, department: 'Housing', assigneeId: sarah.id, dueDate: null, description: 'Repeated complaints about late-night music. Warning letter issued 2026-05-28.' },
    { ref: 'LCI-008', title: 'Broken park bench — Victoria Gardens', status: 'resolved' as const, priority: 'low' as const, department: 'Parks', assigneeId: lisa.id, dueDate: null, description: 'Bench slats replaced and repainted.' },
    { ref: 'LCI-009', title: 'Water main leak — junction High St & Mill Lane', status: 'escalated' as const, priority: 'high' as const, department: 'Highways', assigneeId: marcus.id, dueDate: '2026-06-08', description: 'Thames Water notified. Road closure required. Ongoing.' },
    { ref: 'LCI-010', title: 'Council tax exemption appeal — Mr & Mrs Patel', status: 'awaiting' as const, priority: 'medium' as const, department: 'Housing', assigneeId: sarah.id, dueDate: null, description: 'Awaiting supporting documentation from applicants.' },
    { ref: 'LCI-011', title: 'Graffiti removal request — Bridgeway underpass', status: 'new' as const, priority: 'low' as const, department: 'Environmental Services', assigneeId: tom.id, dueDate: null, description: null },
    { ref: 'LCI-012', title: 'Tree surgery required — Oak Avenue (T1 listed tree)', status: 'review' as const, priority: 'medium' as const, department: 'Parks', assigneeId: lisa.id, dueDate: '2026-07-01', description: 'Arborist report commissioned. Dead branch risk.' },
    { ref: 'LCI-013', title: 'Planning enforcement — unauthorised rear extension', status: 'in_progress' as const, priority: 'high' as const, department: 'Planning', assigneeId: priya.id, dueDate: '2026-06-18', description: 'Extension built without consent at 7 Birch Road. Enforcement notice being drafted.' },
    { ref: 'LCI-014', title: 'Blue badge renewal — Mrs Thompson, 7 Rose Lane', status: 'awaiting' as const, priority: 'medium' as const, department: 'Housing', assigneeId: sarah.id, dueDate: '2026-06-30', description: 'Awaiting GP confirmation of ongoing mobility condition.' },
    { ref: 'LCI-015', title: 'Road markings faded — School Street pedestrian crossing', status: 'new' as const, priority: 'low' as const, department: 'Highways', assigneeId: null, dueDate: null, description: 'Zig-zag and stop line markings barely visible. School term resumes September.' },
    { ref: 'LCI-016', title: 'Abandoned vehicle — Elm Street car park', status: 'review' as const, priority: 'medium' as const, department: 'Environmental Services', assigneeId: tom.id, dueDate: null, description: 'Blue Ford Focus, no plates. DVLA check in progress.' },
  ]

  const inserted = await db.insert(tickets).values(ticketData).returning()

  await db.insert(boardOrder).values(
    inserted.map((t, i) => ({ ticketId: t.id, position: i }))
  )

  await db.insert(activityLog).values([
    { ticketId: inserted[0].id, action: 'moved to In Progress', actorName: 'Marcus Johnson', createdAt: new Date(Date.now() - 3_600_000) },
    { ticketId: inserted[3].id, action: 'escalated — legal involvement flagged', actorName: 'Sarah Chen', createdAt: new Date(Date.now() - 7_200_000) },
    { ticketId: inserted[7].id, action: 'resolved — bench repaired', actorName: 'Lisa Kim', createdAt: new Date(Date.now() - 86_400_000) },
    { ticketId: inserted[8].id, action: 'escalated — road closure authorised', actorName: 'Marcus Johnson', createdAt: new Date(Date.now() - 1_800_000) },
    { ticketId: inserted[6].id, action: 'assigned to Sarah Chen', actorName: 'Admin', createdAt: new Date(Date.now() - 10_800_000) },
  ])

  console.log(`✅ Seeded ${inserted.length} tickets, ${members.length} team members`)
  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 4: Run seed**

```bash
npm run db:seed
```
Expected: `✅ Seeded 16 tickets, 5 team members`

- [ ] **Step 5: Commit**

```bash
git add db/
git commit -m "✨feat: DB client, migrations, and seed data (16 tickets, 5 members)"
```

---

## Task 5: Server Actions

**Files:**
- Create: `lib/actions.ts`
- Create: `lib/__tests__/actions.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `lib/__tests__/actions.test.ts`:

```typescript
import { createTicket, addComment } from '../actions'

jest.mock('@/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

describe('createTicket', () => {
  it('is an async function', () => {
    expect(typeof createTicket).toBe('function')
  })
})

describe('addComment', () => {
  it('is an async function', () => {
    expect(typeof addComment).toBe('function')
  })
})
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
npx jest lib/__tests__/actions.test.ts
```
Expected: FAIL — `Cannot find module '../actions'`

- [ ] **Step 3: Create lib/actions.ts**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tickets, comments, activityLog, boardOrder, teamMembers } from '@/db/schema'
import { eq, max, desc } from 'drizzle-orm'
import type { TicketStatus, TicketPriority } from '@/db/schema'

export async function createTicket(formData: FormData) {
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const priority = formData.get('priority') as TicketPriority
  const department = formData.get('department') as string
  const assigneeId = formData.get('assigneeId') ? Number(formData.get('assigneeId')) : null
  const dueDate = (formData.get('dueDate') as string) || null

  const existing = await db.select({ ref: tickets.ref }).from(tickets)
  const nums = existing.map(t => parseInt(t.ref.split('-')[1])).filter(n => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const ref = `LCI-${String(nextNum).padStart(3, '0')}`

  const [ticket] = await db.insert(tickets).values({
    ref, title, description, priority, department, assigneeId, dueDate, status: 'new',
  }).returning()

  const [{ maxPos }] = await db.select({ maxPos: max(boardOrder.position) }).from(boardOrder)
  await db.insert(boardOrder).values({ ticketId: ticket.id, position: (maxPos ?? -1) + 1 })

  await db.insert(activityLog).values({
    ticketId: ticket.id, action: 'created', actorName: 'Council Officer',
  })

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

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest lib/__tests__/actions.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/
git commit -m "✨feat: Server Actions — createTicket, updateTicket, addComment, getTicketWithDetails"
```

---

## Task 6: PATCH API Route (Drag-Drop)

**Files:**
- Create: `app/api/tickets/route.ts`
- Create: `app/api/tickets/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/tickets/__tests__/route.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/db', () => ({ db: {} }))
jest.mock('@/db/schema', () => ({ tickets: {}, boardOrder: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

describe('PATCH /api/tickets', () => {
  it('returns 400 when body is missing required fields', async () => {
    const { PATCH } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId: 1 }), // missing newStatus and positions
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest app/api/tickets/__tests__/route.test.ts
```
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Create app/api/tickets/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tickets, boardOrder } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { TicketStatus } from '@/db/schema'

interface MovePayload {
  ticketId: number
  newStatus: TicketStatus
  positions: Array<{ ticketId: number; position: number }>
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

  await db.update(tickets)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId))

  await Promise.all(
    positions.map(({ ticketId: tid, position }) =>
      db.update(boardOrder).set({ position }).where(eq(boardOrder.ticketId, tid))
    )
  )

  revalidatePath('/board')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest app/api/tickets/__tests__/route.test.ts
```
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/api/
git commit -m "✨feat: PATCH /api/tickets route for drag-drop reordering"
```

---

## Task 7: Global Styles + Root Layout + Sidebar

**Files:**
- Replace: `app/globals.css`
- Replace: `app/layout.tsx`
- Create: `components/sidebar.tsx`
- Create: `components/sidebar.module.css`

- [ ] **Step 1: Replace app/globals.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --accent: #2F6FEB;
  --accent-light: #EBF1FD;
  --accent-hover: #1a5fd4;
  --bg: #FAFAFA;
  --surface: #FFFFFF;
  --border: #E5E7EB;
  --border-light: #F3F4F6;
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --priority-high: #EF4444;
  --priority-medium: #F59E0B;
  --priority-low: #22C55E;
  --sidebar-width: 240px;
  --radius: 8px;
  --radius-sm: 4px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}

body {
  background: var(--bg);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: 32px;
  overflow-x: auto;
}

button {
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

input, textarea, select {
  font-family: inherit;
  font-size: inherit;
}
```

- [ ] **Step 2: Replace app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Sidebar } from '@/components/sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'London Council Issue Tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create components/sidebar.module.css**

```css
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}

.logoIcon {
  width: 32px;
  height: 32px;
  background: var(--accent);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.logoText {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.logoText span {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}

.nav {
  flex: 1;
  padding: 8px 12px;
}

.navLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 8px 4px;
}

.navItem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: background 0.1s, color 0.1s;
  margin-bottom: 2px;
}

.navItem:hover {
  background: var(--border-light);
  color: var(--text-primary);
}

.navItem.active {
  background: var(--accent-light);
  color: var(--accent);
}

.navIcon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.footer {
  padding: 16px 20px 0;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Create components/sidebar.tsx**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './sidebar.module.css'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/board', label: 'Kanban Board', icon: '☰' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>LC</div>
        <div className={styles.logoText}>
          Issue Tracker
          <span>London Borough Council</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navLabel}>Menu</div>
        {navItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className={styles.footer}>
        London Council © 2026
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Verify dev server compiles**

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). Expected: sidebar renders, no console errors. (Page content will be empty/error — fixed in Task 11.)

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx components/sidebar.tsx components/sidebar.module.css
git commit -m "✨feat: root layout, global design tokens, sidebar navigation"
```

---

## Task 8: Stat Cards Component

**Files:**
- Create: `components/dashboard/stat-cards.tsx`
- Create: `components/dashboard/stat-cards.module.css`
- Create: `components/dashboard/__tests__/stat-cards.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// @jest-environment jsdom
import { render, screen } from '@testing-library/react'
import { StatCards } from '../stat-cards'

const mockStats = {
  totalOpen: 12,
  highPriority: 4,
  escalated: 2,
  resolvedThisWeek: 3,
}

describe('StatCards', () => {
  it('renders all four stat values', () => {
    render(<StatCards {...mockStats} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders all four labels', () => {
    render(<StatCards {...mockStats} />)
    expect(screen.getByText('Open Tickets')).toBeInTheDocument()
    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('Escalated')).toBeInTheDocument()
    expect(screen.getByText('Resolved This Week')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest components/dashboard/__tests__/stat-cards.test.tsx
```
Expected: FAIL — `Cannot find module '../stat-cards'`

- [ ] **Step 3: Create components/dashboard/stat-cards.module.css**

```css
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.card:nth-child(3) .value {
  color: var(--priority-high);
}
```

- [ ] **Step 4: Create components/dashboard/stat-cards.tsx**

```typescript
import styles from './stat-cards.module.css'

interface Props {
  totalOpen: number
  highPriority: number
  escalated: number
  resolvedThisWeek: number
}

export function StatCards({ totalOpen, highPriority, escalated, resolvedThisWeek }: Props) {
  const cards = [
    { value: totalOpen, label: 'Open Tickets' },
    { value: highPriority, label: 'High Priority' },
    { value: escalated, label: 'Escalated' },
    { value: resolvedThisWeek, label: 'Resolved This Week' },
  ]

  return (
    <div className={styles.grid}>
      {cards.map(({ value, label }) => (
        <div key={label} className={styles.card}>
          <span className={styles.value}>{value}</span>
          <span className={styles.label}>{label}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run test — expect pass**

```bash
npx jest components/dashboard/__tests__/stat-cards.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/stat-cards.tsx components/dashboard/stat-cards.module.css components/dashboard/__tests__/stat-cards.test.tsx
git commit -m "✨feat: StatCards dashboard component with tests"
```

---

## Task 9: Dashboard Secondary Components

**Files:**
- Create: `components/dashboard/recent-tickets.tsx` + `.module.css`
- Create: `components/dashboard/dept-breakdown.tsx` + `.module.css`
- Create: `components/dashboard/activity-feed.tsx` + `.module.css`

- [ ] **Step 1: Create components/dashboard/recent-tickets.module.css**

```css
.section { margin-bottom: 32px; }

.heading {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.table {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  border-collapse: collapse;
  overflow: hidden;
}

.table th {
  text-align: left;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.table tr:last-child td { border-bottom: none; }

.ref {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  font-family: monospace;
}

.priority {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.priorityHigh { background: var(--priority-high); }
.priorityMedium { background: var(--priority-medium); }
.priorityLow { background: var(--priority-low); }

.dept {
  font-size: 12px;
  color: var(--text-secondary);
}
```

- [ ] **Step 2: Create components/dashboard/recent-tickets.tsx**

```typescript
import type { Ticket } from '@/db/schema'
import styles from './recent-tickets.module.css'

interface Props {
  tickets: Pick<Ticket, 'id' | 'ref' | 'title' | 'priority' | 'department' | 'status'>[]
}

const priorityClass: Record<string, string> = {
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
}

export function RecentTickets({ tickets }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Recent Tickets</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Title</th>
            <th>Department</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => (
            <tr key={t.id}>
              <td><span className={styles.ref}>{t.ref}</span></td>
              <td>{t.title}</td>
              <td><span className={styles.dept}>{t.department}</span></td>
              <td>
                <span className={`${styles.priority} ${priorityClass[t.priority]}`} />
                {t.priority}
              </td>
              <td>{t.status.replace('_', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create components/dashboard/dept-breakdown.module.css**

```css
.section { margin-bottom: 32px; }

.heading {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.list {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  gap: 12px;
}

.row:last-child { border-bottom: none; }

.dept {
  font-weight: 500;
  min-width: 180px;
}

.bar {
  flex: 1;
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
}

.count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 24px;
  text-align: right;
}
```

- [ ] **Step 4: Create components/dashboard/dept-breakdown.tsx**

```typescript
import styles from './dept-breakdown.module.css'

interface Props {
  breakdown: Array<{ department: string; count: number }>
}

export function DeptBreakdown({ breakdown }: Props) {
  const max = Math.max(...breakdown.map(d => d.count), 1)

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>By Department</h2>
      <div className={styles.list}>
        {breakdown.map(({ department, count }) => (
          <div key={department} className={styles.row}>
            <span className={styles.dept}>{department}</span>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className={styles.count}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create components/dashboard/activity-feed.module.css**

```css
.section { margin-bottom: 32px; }

.heading {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.feed {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.entry {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  align-items: flex-start;
}

.entry:last-child { border-bottom: none; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  margin-top: 5px;
  flex-shrink: 0;
}

.content {
  flex: 1;
  font-size: 13px;
}

.actor { font-weight: 600; }

.time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
```

- [ ] **Step 6: Create components/dashboard/activity-feed.tsx**

```typescript
import type { ActivityEntry } from '@/db/schema'
import styles from './activity-feed.module.css'

interface Props {
  entries: Array<ActivityEntry & { ticketRef: string }>
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ActivityFeed({ entries }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Recent Activity</h2>
      <div className={styles.feed}>
        {entries.map(entry => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.dot} />
            <div className={styles.content}>
              <span className={styles.actor}>{entry.actorName}</span>
              {' '}{entry.action} on <strong>{entry.ticketRef}</strong>
              <div className={styles.time}>{timeAgo(new Date(entry.createdAt))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/
git commit -m "✨feat: dashboard components — recent tickets, dept breakdown, activity feed"
```

---

## Task 10: Dashboard Page

**Files:**
- Replace: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```typescript
import { db } from '@/db'
import { tickets, activityLog, boardOrder } from '@/db/schema'
import { ne, eq, gte, and, desc } from 'drizzle-orm'
import { StatCards } from '@/components/dashboard/stat-cards'
import { RecentTickets } from '@/components/dashboard/recent-tickets'
import { DeptBreakdown } from '@/components/dashboard/dept-breakdown'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

async function getDashboardData() {
  const allTickets = await db.select().from(tickets)

  const totalOpen = allTickets.filter(t => t.status !== 'resolved').length
  const highPriority = allTickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length
  const escalated = allTickets.filter(t => t.status === 'escalated').length
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const resolvedThisWeek = allTickets.filter(
    t => t.status === 'resolved' && new Date(t.updatedAt) >= weekAgo
  ).length

  const recent = allTickets
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const deptMap = new Map<string, number>()
  allTickets.filter(t => t.status !== 'resolved').forEach(t => {
    deptMap.set(t.department, (deptMap.get(t.department) ?? 0) + 1)
  })
  const breakdown = [...deptMap.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count)

  const activityEntries = await db.select({
    id: activityLog.id,
    ticketId: activityLog.ticketId,
    action: activityLog.action,
    actorName: activityLog.actorName,
    createdAt: activityLog.createdAt,
    ticketRef: tickets.ref,
  })
    .from(activityLog)
    .innerJoin(tickets, eq(activityLog.ticketId, tickets.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(8)

  return { totalOpen, highPriority, escalated, resolvedThisWeek, recent, breakdown, activityEntries }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <StatCards
        totalOpen={data.totalOpen}
        highPriority={data.highPriority}
        escalated={data.escalated}
        resolvedThisWeek={data.resolvedThisWeek}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div>
          <RecentTickets tickets={data.recent} />
          <ActivityFeed entries={data.activityEntries} />
        </div>
        <div>
          <DeptBreakdown breakdown={data.breakdown} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

With `npm run dev` running, open [http://localhost:3000](http://localhost:3000).

Expected:
- 4 stat cards show correct numbers (12 open, 4 high, 2 escalated, 0 resolved this week from seed)
- Recent tickets table shows 5 tickets
- Department breakdown shows bars
- Activity feed shows 5 seeded entries

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "✨feat: dashboard page — stat cards, recent tickets, dept breakdown, activity"
```

---

## Task 11: Board Ticket Card

**Files:**
- Create: `components/board/ticket-card.tsx`
- Create: `components/board/ticket-card.module.css`
- Create: `components/board/__tests__/ticket-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// @jest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { TicketCard } from '../ticket-card'

const mockTicket = {
  id: 1,
  ref: 'LCI-001',
  title: 'Pothole on Thornton Road',
  priority: 'high' as const,
  department: 'Highways',
  status: 'in_progress' as const,
  assigneeInitials: 'MJ',
  assigneeColor: '#22C55E',
  dueDate: '2026-06-15',
  position: 0,
}

describe('TicketCard', () => {
  it('renders ref and title', () => {
    render(<TicketCard ticket={mockTicket} onDragStart={jest.fn()} onClick={jest.fn()} />)
    expect(screen.getByText('LCI-001')).toBeInTheDocument()
    expect(screen.getByText('Pothole on Thornton Road')).toBeInTheDocument()
  })

  it('renders assignee initials', () => {
    render(<TicketCard ticket={mockTicket} onDragStart={jest.fn()} onClick={jest.fn()} />)
    expect(screen.getByText('MJ')).toBeInTheDocument()
  })

  it('calls onDragStart when drag begins', () => {
    const onDragStart = jest.fn()
    render(<TicketCard ticket={mockTicket} onDragStart={onDragStart} onClick={jest.fn()} />)
    fireEvent.dragStart(screen.getByText('Pothole on Thornton Road').closest('[draggable]')!)
    expect(onDragStart).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx jest components/board/__tests__/ticket-card.test.tsx
```
Expected: FAIL — `Cannot find module '../ticket-card'`

- [ ] **Step 3: Create components/board/ticket-card.module.css**

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  cursor: grab;
  user-select: none;
  transition: box-shadow 0.15s, opacity 0.15s;
}

.card:hover { box-shadow: var(--shadow); }
.card:active { cursor: grabbing; }
.card.dragging { opacity: 0.4; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ref {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  font-family: monospace;
}

.priority {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 10px;
}

.priorityHigh { background: #FEE2E2; color: var(--priority-high); }
.priorityMedium { background: #FEF3C7; color: var(--priority-medium); }
.priorityLow { background: #DCFCE7; color: var(--priority-low); }

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 10px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dept {
  font-size: 11px;
  color: var(--text-muted);
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: white;
}

.due {
  font-size: 11px;
  color: var(--text-muted);
}

.dueSoon { color: var(--priority-high); }
```

- [ ] **Step 4: Create components/board/ticket-card.tsx**

```typescript
'use client'

import styles from './ticket-card.module.css'

export interface TicketCardData {
  id: number
  ref: string
  title: string
  priority: 'high' | 'medium' | 'low'
  department: string
  status: string
  assigneeInitials: string | null
  assigneeColor: string | null
  dueDate: string | null
  position: number
}

interface Props {
  ticket: TicketCardData
  onDragStart: (ticketId: number) => void
  onClick: (ticketId: number) => void
  isDragging?: boolean
}

const priorityClass: Record<string, string> = {
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
}

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate).getTime() - Date.now() < 3 * 86_400_000
}

export function TicketCard({ ticket, onDragStart, onClick, isDragging }: Props) {
  return (
    <div
      draggable
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      onDragStart={() => onDragStart(ticket.id)}
      onClick={() => onClick(ticket.id)}
    >
      <div className={styles.header}>
        <span className={styles.ref}>{ticket.ref}</span>
        <span className={`${styles.priority} ${priorityClass[ticket.priority]}`}>
          {ticket.priority}
        </span>
      </div>
      <div className={styles.title}>{ticket.title}</div>
      <div className={styles.footer}>
        <span className={styles.dept}>{ticket.department}</span>
        <div className={styles.meta}>
          {ticket.dueDate && (
            <span className={`${styles.due} ${isDueSoon(ticket.dueDate) ? styles.dueSoon : ''}`}>
              {ticket.dueDate}
            </span>
          )}
          {ticket.assigneeInitials && (
            <div
              className={styles.avatar}
              style={{ background: ticket.assigneeColor ?? '#9CA3AF' }}
            >
              {ticket.assigneeInitials}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test — expect pass**

```bash
npx jest components/board/__tests__/ticket-card.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add components/board/ticket-card.tsx components/board/ticket-card.module.css components/board/__tests__/ticket-card.test.tsx
git commit -m "✨feat: TicketCard component — draggable, priority pills, assignee avatar"
```

---

## Task 12: Board Column + Kanban Board (Client)

**Files:**
- Create: `components/board/column.tsx` + `.module.css`
- Create: `components/board/kanban-board.tsx` + `.module.css`

- [ ] **Step 1: Create components/board/column.module.css**

```css
.column {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 10px;
  margin-bottom: 8px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--border-light);
  padding: 2px 7px;
  border-radius: 10px;
}

.cards {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: var(--radius);
  border: 2px dashed transparent;
  min-height: 100px;
  transition: border-color 0.15s, background 0.15s;
}

.cards.dragOver {
  border-color: var(--accent);
  background: var(--accent-light);
}
```

- [ ] **Step 2: Create components/board/column.tsx**

```typescript
'use client'

import { TicketCard, type TicketCardData } from './ticket-card'
import styles from './column.module.css'
import type { TicketStatus } from '@/db/schema'

const COLUMN_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  review: 'Review',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  awaiting: 'Awaiting',
  resolved: 'Resolved',
}

interface Props {
  status: TicketStatus
  tickets: TicketCardData[]
  draggingId: number | null
  onDragStart: (ticketId: number) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (status: TicketStatus) => void
  onTicketClick: (ticketId: number) => void
}

export function Column({ status, tickets, draggingId, onDragStart, onDragOver, onDrop, onTicketClick }: Props) {
  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <span className={styles.title}>{COLUMN_LABELS[status]}</span>
        <span className={styles.count}>{tickets.length}</span>
      </div>
      <div
        className={`${styles.cards} ${draggingId !== null ? styles.dragOver : ''}`}
        onDragOver={onDragOver}
        onDrop={() => onDrop(status)}
      >
        {tickets.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onDragStart={onDragStart}
            onClick={onTicketClick}
            isDragging={ticket.id === draggingId}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create components/board/kanban-board.module.css**

```css
.wrapper { height: 100%; }

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.search {
  flex: 1;
  max-width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  outline: none;
}

.search:focus { border-color: var(--accent); }

.filter {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  outline: none;
}

.createBtn {
  margin-left: auto;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 13px;
}

.createBtn:hover { background: var(--accent-hover); }

.board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 24px;
  align-items: flex-start;
}
```

- [ ] **Step 4: Create components/board/kanban-board.tsx**

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Column } from './column'
import styles from './kanban-board.module.css'
import type { TicketCardData } from './ticket-card'
import type { TicketStatus } from '@/db/schema'

const COLUMN_ORDER: TicketStatus[] = ['new', 'review', 'in_progress', 'escalated', 'awaiting', 'resolved']

interface Props {
  tickets: TicketCardData[]
  onTicketClick: (ticketId: number) => void
  onCreateClick: () => void
}

export function KanbanBoard({ tickets, onTicketClick, onCreateClick }: Props) {
  const router = useRouter()
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterDept, setFilterDept] = useState<string>('all')

  const departments = useMemo(
    () => [...new Set(tickets.map(t => t.department))].sort(),
    [tickets]
  )

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.ref.toLowerCase().includes(search.toLowerCase())) return false
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterDept !== 'all' && t.department !== filterDept) return false
      return true
    })
  }, [tickets, search, filterPriority, filterDept])

  const columns = useMemo(() => {
    const map: Record<TicketStatus, TicketCardData[]> = {
      new: [], review: [], in_progress: [], escalated: [], awaiting: [], resolved: [],
    }
    filtered.forEach(t => map[t.status as TicketStatus].push(t))
    COLUMN_ORDER.forEach(status => map[status].sort((a, b) => a.position - b.position))
    return map
  }, [filtered])

  async function handleDrop(targetStatus: TicketStatus) {
    if (draggingId === null) return
    const ticket = tickets.find(t => t.id === draggingId)
    if (!ticket || ticket.status === targetStatus) { setDraggingId(null); return }

    const targetTickets = [...columns[targetStatus], { ...ticket, status: targetStatus }]
    const positions = targetTickets.map((t, i) => ({ ticketId: t.id, position: i }))

    await fetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: draggingId, newStatus: targetStatus, positions }),
    })

    setDraggingId(null)
    router.refresh()
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search tickets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filter} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className={styles.filter} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="all">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className={styles.createBtn} onClick={onCreateClick}>+ New Ticket</button>
      </div>

      <div className={styles.board}>
        {COLUMN_ORDER.map(status => (
          <Column
            key={status}
            status={status}
            tickets={columns[status]}
            draggingId={draggingId}
            onDragStart={setDraggingId}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/board/column.tsx components/board/column.module.css components/board/kanban-board.tsx components/board/kanban-board.module.css
git commit -m "✨feat: Column and KanbanBoard client components with drag-drop and filters"
```

---

## Task 13: Board Page

**Files:**
- Create: `app/board/page.tsx`

- [ ] **Step 1: Create app/board/page.tsx**

```typescript
import { db } from '@/db'
import { tickets, boardOrder, teamMembers } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { BoardShell } from './board-shell'

async function getBoardData() {
  const rows = await db.select({
    id: tickets.id,
    ref: tickets.ref,
    title: tickets.title,
    priority: tickets.priority,
    department: tickets.department,
    status: tickets.status,
    dueDate: tickets.dueDate,
    position: boardOrder.position,
    assigneeInitials: teamMembers.initials,
    assigneeColor: teamMembers.color,
  })
    .from(tickets)
    .leftJoin(boardOrder, eq(boardOrder.ticketId, tickets.id))
    .leftJoin(teamMembers, eq(teamMembers.id, tickets.assigneeId))
    .orderBy(asc(boardOrder.position))

  return rows.map(r => ({
    ...r,
    position: r.position ?? 999,
    assigneeInitials: r.assigneeInitials ?? null,
    assigneeColor: r.assigneeColor ?? null,
  }))
}

export default async function BoardPage() {
  const tickets = await getBoardData()
  return <BoardShell initialTickets={tickets} />
}
```

- [ ] **Step 2: Create app/board/board-shell.tsx**

This is a Client Component that wires the board, detail panel, and create modal together.

```typescript
'use client'

import { useState } from 'react'
import { KanbanBoard } from '@/components/board/kanban-board'
import { TicketDetail } from '@/components/ticket-detail'
import { CreateTicketModal } from '@/components/create-ticket-modal'
import type { TicketCardData } from '@/components/board/ticket-card'

interface Props {
  initialTickets: TicketCardData[]
}

export function BoardShell({ initialTickets }: Props) {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Kanban Board</h1>
      <KanbanBoard
        tickets={initialTickets}
        onTicketClick={setSelectedTicketId}
        onCreateClick={() => setShowCreate(true)}
      />
      {selectedTicketId !== null && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}
      {showCreate && (
        <CreateTicketModal onClose={() => setShowCreate(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open [http://localhost:3000/board](http://localhost:3000/board).

Expected:
- 6 columns visible (New, Review, In Progress, Escalated, Awaiting, Resolved)
- 16 tickets distributed across columns
- Search box and filters working (try typing "LCI" to filter)
- Drag a card between columns — it should move and re-render

- [ ] **Step 4: Commit**

```bash
git add app/board/
git commit -m "✨feat: board page — Server Component data fetch wired to KanbanBoard"
```

---

## Task 14: Ticket Detail Panel

**Files:**
- Create: `components/ticket-detail.tsx`
- Create: `components/ticket-detail.module.css`

- [ ] **Step 1: Create components/ticket-detail.module.css**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.3);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

.panel {
  width: 480px;
  height: 100vh;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease;
  overflow: hidden;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.ref {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.closeBtn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  padding: 4px;
  line-height: 1;
}

.closeBtn:hover { color: var(--text-primary); }

.body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  line-height: 1.3;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg);
  border-radius: var(--radius);
}

.metaItem {}

.metaLabel {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.metaValue {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.description {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.section {
  margin-bottom: 24px;
}

.sectionTitle {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.comment {
  padding: 12px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.commentAuthor {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
}

.commentInput {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  resize: none;
  height: 38px;
  outline: none;
}

.commentInput:focus { border-color: var(--accent); }

.submitBtn {
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 13px;
}

.submitBtn:hover { background: var(--accent-hover); }

.loading { padding: 24px; color: var(--text-muted); text-align: center; }
```

- [ ] **Step 2: Create components/ticket-detail.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTicketWithDetails, addComment } from '@/lib/actions'
import styles from './ticket-detail.module.css'

interface Props {
  ticketId: number
  onClose: () => void
}

type TicketData = Awaited<ReturnType<typeof getTicketWithDetails>>

export function TicketDetail({ ticketId, onClose }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TicketData>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getTicketWithDetails(ticketId).then(setData)
  }, [ticketId])

  async function handleSubmitComment() {
    if (!comment.trim()) return
    setSubmitting(true)
    await addComment(ticketId, comment.trim())
    setComment('')
    const updated = await getTicketWithDetails(ticketId)
    setData(updated)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.ref}>{data?.ref ?? '...'}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {!data ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            <div className={styles.body}>
              <div className={styles.title}>{data.title}</div>

              <div className={styles.meta}>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Status</div>
                  <div className={styles.metaValue}>{data.status.replace('_', ' ')}</div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Priority</div>
                  <div className={styles.metaValue}>{data.priority}</div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Department</div>
                  <div className={styles.metaValue}>{data.department}</div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Assignee</div>
                  <div className={styles.metaValue}>{data.assignee?.name ?? 'Unassigned'}</div>
                </div>
                {data.dueDate && (
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Due Date</div>
                    <div className={styles.metaValue}>{data.dueDate}</div>
                  </div>
                )}
              </div>

              {data.description && (
                <div className={styles.description}>{data.description}</div>
              )}

              {data.comments.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Comments ({data.comments.length})</div>
                  {data.comments.map(c => (
                    <div key={c.id} className={styles.comment}>
                      <div className={styles.commentAuthor}>{c.authorName}</div>
                      {c.body}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <textarea
                className={styles.commentInput}
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmitComment())}
              />
              <button
                className={styles.submitBtn}
                onClick={handleSubmitComment}
                disabled={submitting || !comment.trim()}
              >
                Post
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Click any ticket card on the board. Expected:
- Slide-in panel appears from the right
- Ticket title, ref, meta details visible
- Click overlay background closes panel
- Type a comment, press Enter or click Post — comment appears

- [ ] **Step 4: Commit**

```bash
git add components/ticket-detail.tsx components/ticket-detail.module.css
git commit -m "✨feat: TicketDetail slide-in panel with comments"
```

---

## Task 15: Create Ticket Modal

**Files:**
- Create: `components/create-ticket-modal.tsx`
- Create: `components/create-ticket-modal.module.css`

- [ ] **Step 1: Create components/create-ticket-modal.module.css**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.4);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius);
  width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.2);
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.header h2 {
  font-size: 16px;
  font-weight: 600;
}

.closeBtn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-muted);
  padding: 4px;
}

.closeBtn:hover { color: var(--text-primary); }

.form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.required { color: var(--priority-high); margin-left: 2px; }

.input, .select, .textarea {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface);
  outline: none;
  width: 100%;
}

.input:focus, .select:focus, .textarea:focus { border-color: var(--accent); }

.textarea { resize: vertical; min-height: 80px; }

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.cancelBtn {
  padding: 8px 16px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
}

.cancelBtn:hover { background: var(--bg); }

.submitBtn {
  padding: 8px 20px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
}

.submitBtn:hover { background: var(--accent-hover); }
.submitBtn:disabled { opacity: 0.6; cursor: not-allowed; }
```

- [ ] **Step 2: Create components/create-ticket-modal.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket } from '@/lib/actions'
import styles from './create-ticket-modal.module.css'

const DEPARTMENTS = [
  'Highways', 'Housing', 'Parks', 'Environmental Services', 'Planning',
]

interface Props {
  onClose: () => void
}

export function CreateTicketModal({ onClose }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    await createTicket(formData)
    setSubmitting(false)
    router.refresh()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>New Ticket</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>
                Title <span className={styles.required}>*</span>
              </label>
              <input
                name="title"
                className={styles.input}
                placeholder="Brief description of the issue"
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea
                name="description"
                className={styles.textarea}
                placeholder="Additional details..."
              />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>
                  Priority <span className={styles.required}>*</span>
                </label>
                <select name="priority" className={styles.select} defaultValue="medium" required>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Department <span className={styles.required}>*</span>
                </label>
                <select name="department" className={styles.select} defaultValue="" required>
                  <option value="" disabled>Select...</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Due Date</label>
                <input type="date" name="dueDate" className={styles.input} />
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Click "+ New Ticket" on the board. Expected:
- Modal opens with animation
- Fill in title, priority, department
- Submit — modal closes, new ticket appears in "New" column
- Ref is auto-incremented (LCI-017)

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add components/create-ticket-modal.tsx components/create-ticket-modal.module.css
git commit -m "✨feat: CreateTicketModal — form with Server Action, auto-incremented ref"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Run the app end-to-end**

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Walk through:
1. [http://localhost:3000](http://localhost:3000) — dashboard shows 4 stat cards, recent tickets, dept breakdown, activity feed
2. [http://localhost:3000/board](http://localhost:3000/board) — 6 columns, 16 tickets
3. Drag a ticket from "New" to "In Progress" — it moves
4. Click a ticket — detail panel slides in, shows description and comments
5. Add a comment — appears without page reload
6. Click "+ New Ticket" — modal opens, create a ticket — appears in "New" column
7. Use the search box — filters tickets in real time
8. Use priority/department dropdowns — filters correctly

- [ ] **Final commit**

```bash
git add .
git commit -m "✨feat: complete London Council Kanban extraction — Next.js, PostgreSQL, Drizzle"
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-06-kanban-extraction.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
