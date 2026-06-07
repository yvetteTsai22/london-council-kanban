/**
 * @jest-environment node
 */

const mockWhere = jest.fn()
const mockFrom = jest.fn(() => ({ where: mockWhere }))

jest.mock('@/db', () => ({
  db: { select: () => ({ from: mockFrom }) },
}))
jest.mock('@/db/schema', () => ({ webhooks: 'webhooks_table' }))
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }))

describe('fireWebhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)
  })

  it('POSTs to matching webhook URLs', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['ticket.created'], active: true },
    ])

    const { fireWebhooks } = await import('../webhooks')
    fireWebhooks('ticket.created', { id: 1, ref: 'LCI-001' })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.event).toBe('ticket.created')
    expect(body.data).toEqual({ id: 1, ref: 'LCI-001' })
  })

  it('does not POST for non-matching events', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['ticket.updated'], active: true },
    ])

    const { fireWebhooks } = await import('../webhooks')
    fireWebhooks('ticket.created', { id: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('matches wildcard "*" subscriptions', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['*'], active: true },
    ])

    const { fireWebhooks } = await import('../webhooks')
    fireWebhooks('ticket.comment_added', { id: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not throw when fetch fails', async () => {
    mockWhere.mockResolvedValue([
      { id: 1, url: 'https://example.com/hook', events: ['*'], active: true },
    ])
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { fireWebhooks } = await import('../webhooks')
    expect(() => fireWebhooks('ticket.created', {})).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})
