import { db } from '@/db'
import { webhooks } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type WebhookEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.comment_added'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: unknown
}

export function fireWebhooks(event: WebhookEvent, data: unknown): void {
  void (async () => {
    try {
      const targets = await db.select().from(webhooks).where(eq(webhooks.active, true))
      const matching = targets.filter(
        (w) => w.events.includes(event) || w.events.includes('*')
      )
      const payload: WebhookPayload = { event, timestamp: new Date().toISOString(), data }
      for (const webhook of matching) {
        void fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Delivery failure is intentionally silent
        })
      }
    } catch {
      // Don't surface webhook errors to the caller
    }
  })()
}
