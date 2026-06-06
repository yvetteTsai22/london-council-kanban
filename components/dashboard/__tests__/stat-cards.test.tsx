/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react'
import { StatCards } from '../stat-cards'

const mockStats = {
  totalOpen: 12,
  highPriority: 4,
  escalated: 2,
  resolvedThisWeek: 3,
}

describe('StatCards', () => {
  it('renders all four stat values', () => {
    render(<StatCards {...mockStats} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders all four labels', () => {
    render(<StatCards {...mockStats} />)
    expect(screen.getByText('Open Tickets')).toBeInTheDocument()
    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('Escalated')).toBeInTheDocument()
    expect(screen.getByText('Resolved This Week')).toBeInTheDocument()
  })
})
