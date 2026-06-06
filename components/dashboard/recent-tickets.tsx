import type { Ticket } from '@/db/schema'
import styles from './recent-tickets.module.css'

interface Props {
  tickets: Pick<Ticket, 'id' | 'ref' | 'title' | 'priority' | 'department' | 'status'>[]
}

const priorityClass: Record<string, string> = {
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
}

export function RecentTickets({ tickets }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Recent Tickets</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Title</th>
            <th>Department</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => (
            <tr key={t.id}>
              <td><span className={styles.ref}>{t.ref}</span></td>
              <td>{t.title}</td>
              <td><span className={styles.dept}>{t.department}</span></td>
              <td>
                <span className={`${styles.priority} ${priorityClass[t.priority]}`} />
                {t.priority}
              </td>
              <td>{t.status.replace('_', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
