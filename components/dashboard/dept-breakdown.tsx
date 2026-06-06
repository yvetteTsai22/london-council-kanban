import styles from './dept-breakdown.module.css'

interface Props {
  breakdown: Array<{ department: string; count: number }>
}

export function DeptBreakdown({ breakdown }: Props) {
  const max = Math.max(...breakdown.map(d => d.count), 1)

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>By Department</h2>
      <div className={styles.list}>
        {breakdown.map(({ department, count }) => (
          <div key={department} className={styles.row}>
            <span className={styles.dept}>{department}</span>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className={styles.count}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
