/**
 * @jest-environment node
 */
import { createTicket, addComment } from '../actions'

jest.mock('@/db', () => ({ db: {} }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

describe('createTicket', () => {
  it('is an async function', () => {
    expect(typeof createTicket).toBe('function')
    expect(createTicket.constructor.name).toBe('AsyncFunction')
  })
})

describe('addComment', () => {
  it('is an async function', () => {
    expect(typeof addComment).toBe('function')
    expect(addComment.constructor.name).toBe('AsyncFunction')
  })
})
