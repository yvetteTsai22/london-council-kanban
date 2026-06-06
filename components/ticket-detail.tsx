'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTicketWithDetails, addComment } from '@/lib/actions'
import styles from './ticket-detail.module.css'

interface Props {
  ticketId: number
  onClose: () => void
}

type TicketData = Awaited<ReturnType<typeof getTicketWithDetails>>

export function TicketDetail({ ticketId, onClose }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TicketData>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getTicketWithDetails(ticketId)
      .then(result => { if (!cancelled) setData(result) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [ticketId])

  async function handleSubmitComment() {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await addComment(ticketId, comment.trim())
      setComment('')
      const updated = await getTicketWithDetails(ticketId)
      setData(updated)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.ref}>{data?.ref ?? '...'}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {!data ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            <div className={styles.body}>
              <div className={styles.title}>{data.title}</div>

              <div className={styles.meta}>
                <div>
                  <div className={styles.metaLabel}>Status</div>
                  <div className={styles.metaValue}>{data.status.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>Priority</div>
                  <div className={styles.metaValue}>{data.priority}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>Department</div>
                  <div className={styles.metaValue}>{data.department}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>Assignee</div>
                  <div className={styles.metaValue}>{data.assignee?.name ?? 'Unassigned'}</div>
                </div>
                {data.dueDate && (
                  <div>
                    <div className={styles.metaLabel}>Due Date</div>
                    <div className={styles.metaValue}>{data.dueDate}</div>
                  </div>
                )}
              </div>

              {data.description && (
                <div className={styles.description}>{data.description}</div>
              )}

              {data.comments.length > 0 && (
                <div>
                  <div className={styles.sectionTitle}>Comments ({data.comments.length})</div>
                  {data.comments.map(c => (
                    <div key={c.id} className={styles.comment}>
                      <div className={styles.commentAuthor}>{c.authorName}</div>
                      {c.body}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <textarea
                className={styles.commentInput}
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitComment()
                  }
                }}
              />
              <button
                className={styles.submitBtn}
                onClick={handleSubmitComment}
                disabled={submitting || !comment.trim()}
              >
                Post
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
