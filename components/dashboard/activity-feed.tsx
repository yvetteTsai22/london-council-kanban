import type { ActivityEntry } from '@/db/schema'
import styles from './activity-feed.module.css'

interface Props {
  entries: Array<ActivityEntry & { ticketRef: string }>
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ActivityFeed({ entries }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Recent Activity</h2>
      <div className={styles.feed}>
        {entries.map(entry => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.dot} />
            <div className={styles.content}>
              <span className={styles.actor}>{entry.actorName}</span>
              {' '}{entry.action} on <strong>{entry.ticketRef}</strong>
              <div className={styles.time}>{timeAgo(new Date(entry.createdAt))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
