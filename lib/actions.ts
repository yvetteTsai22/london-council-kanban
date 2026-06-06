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
