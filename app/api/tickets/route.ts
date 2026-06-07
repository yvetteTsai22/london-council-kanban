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
