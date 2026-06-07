import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhooks } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const webhookId = parseInt(id, 10)
  if (isNaN(webhookId)) {
    return NextResponse.json({ success: false, error: 'Invalid webhook id' }, { status: 400 })
  }

  const [deleted] = await db.delete(webhooks).where(eq(webhooks.id, webhookId)).returning()
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: deleted })
}
