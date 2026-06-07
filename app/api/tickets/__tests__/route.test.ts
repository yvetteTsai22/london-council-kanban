/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/db', () => ({ db: { transaction: jest.fn(), select: jest.fn(), update: jest.fn() } }))
jest.mock('@/db/schema', () => ({ tickets: {}, boardOrder: {}, webhooks: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), and: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/db/tickets', () => ({ createTicketRecord: jest.fn() }))
jest.mock('@/lib/webhooks', () => ({ fireWebhooks: jest.fn() }))

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

  it('calls fireWebhooks with ticket.status_changed on success', async () => {
    const { db } = await import('@/db')
    ;(db.transaction as jest.Mock).mockResolvedValue(undefined)

    const { fireWebhooks } = await import('@/lib/webhooks')
    const { PATCH } = await import('../route')

    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({
        ticketId: 1,
        newStatus: 'in_progress',
        positions: [{ ticketId: 1, position: 0 }],
      }),
    })
    await PATCH(req)

    expect(fireWebhooks).toHaveBeenCalledWith(
      'ticket.status_changed',
      { ticketId: 1, newStatus: 'in_progress' }
    )
  })
})

describe('GET /api/tickets', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with ticket list when no filters', async () => {
    const mockTickets = [{ id: 1, ref: 'LCI-001', title: 'Test', status: 'new' }]
    const { db } = await import('@/db')
    ;(db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockResolvedValue(mockTickets),
    })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockTickets)
  })

  it('applies .where() when query params are present', async () => {
    const mockWhere = jest.fn().mockResolvedValue([])
    const { db } = await import('@/db')
    ;(db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ where: mockWhere }),
    })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets?status=new')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockWhere).toHaveBeenCalled()
  })
})

describe('POST /api/tickets', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'No priority or dept' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 with created ticket on valid input', async () => {
    const mockTicket = { id: 2, ref: 'LCI-002', title: 'Road issue', status: 'new' }
    const { createTicketRecord } = await import('@/lib/db/tickets')
    ;(createTicketRecord as jest.Mock).mockResolvedValue(mockTicket)

    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'Road issue', priority: 'high', department: 'Highways' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockTicket)
  })
})
