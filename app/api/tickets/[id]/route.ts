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
