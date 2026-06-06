/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/db', () => ({ db: {} }))
jest.mock('@/db/schema', () => ({ tickets: {}, boardOrder: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

describe('PATCH /api/tickets', () => {
  it('returns 400 when body is missing required fields', async () => {
    const { PATCH } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId: 1 }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
