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
