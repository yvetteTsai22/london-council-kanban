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
