'use client'

import styles from './ticket-card.module.css'
import type { TicketStatus, TicketPriority } from '@/db/schema'

export interface TicketCardData {
  id: number
  ref: string
  title: string
  priority: TicketPriority
  department: string
  status: TicketStatus
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

const priorityClass: Record<TicketPriority, string> = {
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
