import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhooks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { WebhookEvent } from '@/lib/webhooks'

const VALID_EVENTS: Array<WebhookEvent | '*'> = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.comment_added',
  '*',
]

export async function GET() {
  const results = await db.select().from(webhooks).where(eq(webhooks.active, true))
  return NextResponse.json({ success: true, data: results })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, events } = body as Record<string, unknown>

  if (!url || typeof url !== 'string' || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { success: false, error: 'url and events (non-empty array) are required' },
      { status: 400 }
    )
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 })
  }

  const invalid = (events as unknown[]).filter((e) => !VALID_EVENTS.includes(e as WebhookEvent))
  if (invalid.length > 0) {
    return NextResponse.json(
      { success: false, error: `Invalid events: ${invalid.join(', ')}` },
      { status: 400 }
    )
  }

  const [created] = await db.insert(webhooks).values({ url, events: events as string[] }).returning()
  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
