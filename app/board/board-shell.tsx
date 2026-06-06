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
