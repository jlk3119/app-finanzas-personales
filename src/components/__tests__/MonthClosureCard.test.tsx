/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthClosureCard from '../MonthClosureCard'
import { createClient } from '@/utils/supabase/client'
import type { Expense, Category, Budget, Income } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const cat: Category = { id: 'cat-1', company_id: 'company-1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' }

const expenses: Expense[] = [
  { id: 'e1', company_id: 'company-1', category_id: 'cat-1', amount: 200_000, description: 'Mercado', date: '2026-04-15', created_at: '', categories: cat },
  { id: 'e2', company_id: 'company-1', category_id: 'cat-1', amount: 100_000, description: 'Restaurante', date: '2026-04-20', created_at: '', categories: cat },
]

const budget: Budget = { id: 'bud-1', company_id: 'company-1', category_id: null, period: 'monthly', amount: 1_000_000, year: 2026, month: 4, week: null, created_at: '' }

const income: Income[] = []

const defaultProps = {
  companyId: 'company-1',
  prevYear: 2026,
  prevMonth: 4,
  expenses,
  categories: [cat],
  budgets: [budget],
  income,
  onClose: jest.fn(),
  onRefresh: jest.fn(),
}

function makeMock() {
  const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({ upsert: mockUpsert }),
  } as any)
  return { mockUpsert }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('MonthClosureCard', () => {
  it('muestra el nombre del mes cerrado', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getByText(/abril/i)).toBeInTheDocument()
  })

  it('muestra el total gastado', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getAllByText(/300\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('muestra el presupuesto del mes', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getByText(/1\.?000\.?000/)).toBeInTheDocument()
  })

  it('muestra el margen positivo cuando hay superávit', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getByText(/a tu favor/i)).toBeInTheDocument()
  })

  it('muestra el margen negativo cuando hay déficit', () => {
    const bigExpenses: Expense[] = [
      { id: 'e1', company_id: 'company-1', category_id: 'cat-1', amount: 1_200_000, description: 'Mucho', date: '2026-04-15', created_at: '', categories: cat },
    ]
    render(<MonthClosureCard {...defaultProps} expenses={bigExpenses} />)
    expect(screen.getByText(/déficit/i)).toBeInTheDocument()
  })

  it('muestra saldo a favor cuando hay superávit', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getByText(/saldo a favor/i)).toBeInTheDocument()
  })

  it('no muestra saldo a favor cuando hay déficit', () => {
    const bigExpenses: Expense[] = [
      { id: 'e1', company_id: 'company-1', category_id: 'cat-1', amount: 1_200_000, description: 'Mucho', date: '2026-04-15', created_at: '', categories: cat },
    ]
    render(<MonthClosureCard {...defaultProps} expenses={bigExpenses} />)
    expect(screen.queryByText(/saldo a favor/i)).not.toBeInTheDocument()
  })

  it('registra el cierre de mes al hacer clic en "Entendido"', async () => {
    const { mockUpsert } = makeMock()
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(<MonthClosureCard {...defaultProps} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /entendido/i }))
    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('muestra el desglose por categorías', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getByText('Alimentación')).toBeInTheDocument()
  })
})
