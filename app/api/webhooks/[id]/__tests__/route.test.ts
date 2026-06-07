/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const mockReturning = jest.fn()
const mockWhere = jest.fn(() => ({ returning: mockReturning }))
const mockDelete = jest.fn(() => ({ where: mockWhere }))

jest.mock('@/db', () => ({ db: { delete: mockDelete } }))
jest.mock('@/db/schema', () => ({ webhooks: {} }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))

describe('DELETE /api/webhooks/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 for a non-numeric id', async () => {
    const { DELETE } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/abc', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the webhook does not exist', async () => {
    mockReturning.mockResolvedValue([])
    const { DELETE } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/999', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with the deleted webhook', async () => {
    const mockHook = { id: 1, url: 'https://example.com', events: ['*'], active: true }
    mockReturning.mockResolvedValue([mockHook])

    const { DELETE } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(mockHook)
  })
})
