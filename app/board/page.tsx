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
  const boardTickets = await getBoardData()
  return <BoardShell initialTickets={boardTickets} />
}
