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

    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: draggingId, newStatus: targetStatus, positions }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.refresh()
    } catch {
      // drop silently fails — board refreshes to last known good state
      router.refresh()
    } finally {
      setDraggingId(null)
    }
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
