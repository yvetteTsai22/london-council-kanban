import styles from './stat-cards.module.css'

interface Props {
  totalOpen: number
  highPriority: number
  escalated: number
  resolvedThisWeek: number
}

export function StatCards({ totalOpen, highPriority, escalated, resolvedThisWeek }: Props) {
  const cards = [
    { value: totalOpen, label: 'Open Tickets' },
    { value: highPriority, label: 'High Priority' },
    { value: escalated, label: 'Escalated' },
    { value: resolvedThisWeek, label: 'Resolved This Week' },
  ]

  return (
    <div className={styles.grid}>
      {cards.map(({ value, label }) => (
        <div key={label} className={styles.card}>
          <span className={styles.value}>{value}</span>
          <span className={styles.label}>{label}</span>
        </div>
      ))}
    </div>
  )
}
