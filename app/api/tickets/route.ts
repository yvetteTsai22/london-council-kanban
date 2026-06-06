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
