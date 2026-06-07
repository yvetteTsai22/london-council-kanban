/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockSelect = jest.fn()

jest.mock('@/db', () => ({ db: { select: mockSelect } }))
jest.mock('@/db/schema', () => ({
  tickets: {}, comments: {}, activityLog: {}, teamMembers: {},
}))
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), desc: jest.fn() }))

describe('GET /api/tickets/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 for non-numeric id', async () => {
    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets/abc')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when ticket does not exist', async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
    })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets/999')
    const res = await GET(req, { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with ticket details when found', async () => {
    const mockTicket = { id: 1, ref: 'LCI-001', title: 'Test', assigneeId: null }
    const mockComments = [{ id: 1, body: 'A comment' }]

    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockTicket]) }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(mockComments) }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ orderBy: jest.fn().mockResolvedValue([]) }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([]),
      })

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/tickets/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.ref).toBe('LCI-001')
    expect(body.data.comments).toEqual(mockComments)
  })
})
