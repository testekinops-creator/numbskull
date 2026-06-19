import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CrossclimbBoard from './CrossclimbBoard.jsx'

describe('CrossclimbBoard', () => {
  it('renders the word on every rung in the given order', () => {
    const order = ['COLD', 'CORD', 'CARD', 'CART', 'CARE', 'BARE']
    render(<CrossclimbBoard order={order} onOrder={vi.fn()} />)
    for (const w of order) {
      expect(screen.getByText(w)).toBeInTheDocument()
    }
  })

  it('renders move controls (not in point/watch mode)', () => {
    render(<CrossclimbBoard order={['COLD', 'CORD', 'CARD']} onOrder={vi.fn()} />)
    // 3 rungs × 2 arrows
    expect(screen.getAllByRole('button').length).toBe(6)
  })
})
