'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket } from '@/lib/actions'
import styles from './create-ticket-modal.module.css'

const DEPARTMENTS = [
  'Highways', 'Housing', 'Parks', 'Environmental Services', 'Planning',
]

interface Props {
  onClose: () => void
}

export function CreateTicketModal({ onClose }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    try {
      await createTicket(formData)
      router.refresh()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>New Ticket</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>
                Title <span className={styles.required}>*</span>
              </label>
              <input
                name="title"
                className={styles.input}
                placeholder="Brief description of the issue"
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea
                name="description"
                className={styles.textarea}
                placeholder="Additional details..."
              />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>
                  Priority <span className={styles.required}>*</span>
                </label>
                <select name="priority" className={styles.select} defaultValue="medium" required>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Department <span className={styles.required}>*</span>
                </label>
                <select name="department" className={styles.select} defaultValue="" required>
                  <option value="" disabled>Select...</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Due Date</label>
              <input type="date" name="dueDate" className={styles.input} />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
