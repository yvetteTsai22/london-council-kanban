/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockReturning = jest.fn()
const mockValues = jest.fn(() => ({ returning: mockReturning }))
const mockInsert = jest.fn(() => ({ values: mockValues }))
const mockWhere = jest.fn()
const mockFrom = jest.fn(() => ({ where: mockWhere }))
const mockSelect = jest.fn(() => ({ from: mockFrom }))

jest.mock('@/db', () => ({ db: { select: mockSelect, insert: mockInsert } }))
jest.mock('@/db/schema', () => ({ webhooks: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))

describe('GET /api/webhooks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with list of active webhooks', async () => {
    const mockHooks = [{ id: 1, url: 'https://example.com', events: ['*'], active: true }]
    mockWhere.mockResolvedValue(mockHooks)

    const { GET } = await import('../route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockHooks)
  })
})

describe('POST /api/webhooks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when url is missing', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ events: ['ticket.created'] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 400 when events array is empty', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', events: [] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 400 for an invalid URL format', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url', events: ['*'] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 400 for unknown event names', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', events: ['ticket.deleted'] }),
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('returns 201 with created webhook on valid input', async () => {
    const mockHook = { id: 1, url: 'https://example.com', events: ['*'], active: true }
    mockReturning.mockResolvedValue([mockHook])

    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', events: ['*'] }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockHook)
  })
})
