/**
 * @jest-environment node
 */

const mockTicket = {
  id: 1, ref: 'LCI-001', title: 'Fix pothole', status: 'new',
  priority: 'medium', department: 'Highways', description: null,
  assigneeId: null, dueDate: null, createdAt: new Date(), updatedAt: new Date(),
}

jest.mock('@/db', () => ({
  db: { transaction: jest.fn().mockResolvedValue(mockTicket) },
}))
jest.mock('@/db/schema', () => ({
  tickets: 'tickets', boardOrder: 'boardOrder', activityLog: 'activityLog',
}))
jest.mock('drizzle-orm', () => ({ max: jest.fn() }))

describe('createTicketRecord', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls db.transaction and returns the created ticket', async () => {
    const { db } = await import('@/db')
    const { createTicketRecord } = await import('../tickets')

    const result = await createTicketRecord({
      title: 'Fix pothole',
      priority: 'medium',
      department: 'Highways',
    })

    expect(db.transaction).toHaveBeenCalled()
    expect(result).toEqual(mockTicket)
  })
})
