/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthClosureCard from '../MonthClosureCard'
import { createClient } from '@/utils/supabase/client'
import type { Expense, Category, Budget, Goal, Income } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const cat: Category = { id: 'cat-1', user_id: 'u1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' }

const expenses: Expense[] = [
  { id: 'e1', user_id: 'u1', category_id: 'cat-1', amount: 200_000, description: 'Mercado', date: '2026-04-15', created_at: '', categories: cat },
  { id: 'e2', user_id: 'u1', category_id: 'cat-1', amount: 100_000, description: 'Restaurante', date: '2026-04-20', created_at: '', categories: cat },
]

const budget: Budget = { id: 'bud-1', user_id: 'u1', category_id: null, period: 'monthly', amount: 1_000_000, year: 2026, month: 4, week: null, created_at: '' }

const activeGoal: Goal = { id: 'g1', user_id: 'u1', name: 'Fondo emergencias', target_amount: 6_000_000, current_amount: 0, deadline: null, icon: '🏦', completed: false, category_id: null, created_at: '' }

const income: Income[] = []

const defaultProps = {
  prevYear: 2026,
  prevMonth: 4,
  expenses,
  categories: [cat],
  budgets: [budget],
  goals: [activeGoal],
  income,
  onClose: jest.fn(),
  onRefresh: jest.fn(),
}

function makeMock() {
  const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockReturnValue({ upsert: mockUpsert, update: mockUpdate }),
  } as any)
  return { mockUpsert, mockUpdate, mockEq }
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
      { id: 'e1', user_id: 'u1', category_id: 'cat-1', amount: 1_200_000, description: 'Mucho', date: '2026-04-15', created_at: '', categories: cat },
    ]
    render(<MonthClosureCard {...defaultProps} expenses={bigExpenses} />)
    expect(screen.getByText(/déficit/i)).toBeInTheDocument()
  })

  it('ofrece mover el saldo a una meta cuando hay superávit y hay metas activas', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /mover a meta/i })).toBeInTheDocument()
  })

  it('no ofrece mover a meta si no hay superávit', () => {
    const bigExpenses: Expense[] = [
      { id: 'e1', user_id: 'u1', category_id: 'cat-1', amount: 1_200_000, description: 'Mucho', date: '2026-04-15', created_at: '', categories: cat },
    ]
    render(<MonthClosureCard {...defaultProps} expenses={bigExpenses} />)
    expect(screen.queryByRole('button', { name: /mover a meta/i })).not.toBeInTheDocument()
  })

  it('muestra el picker de metas al hacer clic en "Mover a meta"', async () => {
    const user = userEvent.setup()
    render(<MonthClosureCard {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /mover a meta/i }))
    expect(screen.getByText('Fondo emergencias')).toBeInTheDocument()
  })

  it('actualiza la meta y registra el cierre al mover el saldo', async () => {
    const { mockUpsert, mockEq } = makeMock()
    const onRefresh = jest.fn()
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(<MonthClosureCard {...defaultProps} onRefresh={onRefresh} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /mover a meta/i }))
    await user.click(screen.getByText('Fondo emergencias'))
    await waitFor(() => {
      expect(mockEq).toHaveBeenCalled()    // update goal
      expect(mockUpsert).toHaveBeenCalled() // create month_closure
      expect(onRefresh).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
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

  it('con budgetPeriod, suma los gastos por budget_period y no por fecha', () => {
    // Un gasto fechado en junio pero presupuestado a junio, y otro fechado en junio
    // pero presupuestado a julio. Al cerrar junio solo debe contar el primero.
    const junExpenses: Expense[] = [
      { id: 'e1', user_id: 'u1', category_id: 'cat-1', amount: 200_000, description: 'Junio', date: '2026-06-01', budget_period: '2026-06', created_at: '', categories: cat },
      { id: 'e2', user_id: 'u1', category_id: 'cat-1', amount: 999_000, description: 'Julio', date: '2026-06-03', budget_period: '2026-07', created_at: '', categories: cat },
    ]
    render(
      <MonthClosureCard
        {...defaultProps}
        prevYear={2026}
        prevMonth={6}
        budgetPeriod="2026-06"
        budgets={[]}
        goals={[]}
        expenses={junExpenses}
      />,
    )
    expect(screen.getAllByText(/200\.?000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/999\.?000/)).not.toBeInTheDocument()
  })

  it('sin budgetPeriod conserva el comportamiento por fecha (retrocompatible)', () => {
    render(<MonthClosureCard {...defaultProps} />)
    expect(screen.getAllByText(/300\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('registra el cierre con el año y mes seleccionados', async () => {
    const { mockUpsert } = makeMock()
    const user = userEvent.setup()
    render(<MonthClosureCard {...defaultProps} prevYear={2026} prevMonth={6} budgetPeriod="2026-06" budgets={[]} goals={[]} />)
    await user.click(screen.getByRole('button', { name: /entendido/i }))
    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ year: 2026, month: 6 }))
    })
  })
})
