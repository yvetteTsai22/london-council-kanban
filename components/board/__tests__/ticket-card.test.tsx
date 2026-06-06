import { render, screen, fireEvent } from '@testing-library/react'
import { TicketCard } from '../ticket-card'

const mockTicket = {
  id: 1,
  ref: 'LCI-001',
  title: 'Pothole on Thornton Road',
  priority: 'high' as const,
  department: 'Highways',
  status: 'in_progress' as const,
  assigneeInitials: 'MJ',
  assigneeColor: '#22C55E',
  dueDate: '2026-06-15',
  position: 0,
}

describe('TicketCard', () => {
  it('renders ref and title', () => {
    render(<TicketCard ticket={mockTicket} onDragStart={jest.fn()} onClick={jest.fn()} />)
    expect(screen.getByText('LCI-001')).toBeInTheDocument()
    expect(screen.getByText('Pothole on Thornton Road')).toBeInTheDocument()
  })

  it('renders assignee initials', () => {
    render(<TicketCard ticket={mockTicket} onDragStart={jest.fn()} onClick={jest.fn()} />)
    expect(screen.getByText('MJ')).toBeInTheDocument()
  })

  it('calls onDragStart when drag begins', () => {
    const onDragStart = jest.fn()
    render(<TicketCard ticket={mockTicket} onDragStart={onDragStart} onClick={jest.fn()} />)
    const card = screen.getByText('Pothole on Thornton Road').closest('[draggable]')!
    fireEvent.dragStart(card)
    expect(onDragStart).toHaveBeenCalledWith(1)
  })
})
