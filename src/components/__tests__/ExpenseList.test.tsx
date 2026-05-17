/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseList from '../ExpenseList'
import { createClient } from '@/utils/supabase/client'
import type { Category, Expense } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const cat: Category = { id: 'cat-1', user_id: 'u1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' }

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = toLocalDateStr(new Date())
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalDateStr(d) })()

const mockExpenses: Expense[] = [
  { id: 'e1', user_id: 'u1', category_id: 'cat-1', amount: 50000, description: 'Supermercado', date: today, created_at: '', categories: cat },
  { id: 'e2', user_id: 'u1', category_id: 'cat-1', amount: 15000, description: 'Bus', date: yesterday, created_at: '', categories: cat },
  { id: 'e3', user_id: 'u1', category_id: null, amount: 8000, description: 'Café', date: '2020-03-10', created_at: '' },
]

function makeDeleteMock() {
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ delete: mockDelete }) } as any)
  return { mockDelete, mockEq }
}

beforeEach(() => makeDeleteMock())
afterEach(() => jest.clearAllMocks())

describe('ExpenseList', () => {
  it('renderiza la lista de gastos', () => {
    render(<ExpenseList expenses={mockExpenses} categories={[cat]} onRefresh={jest.fn()} />)
    expect(screen.getByText('Supermercado')).toBeInTheDocument()
    expect(screen.getByText('Bus')).toBeInTheDocument()
    expect(screen.getByText('Café')).toBeInTheDocument()
  })

  it('muestra "Hoy" para el gasto de hoy', () => {
    render(<ExpenseList expenses={[mockExpenses[0]]} categories={[cat]} onRefresh={jest.fn()} />)
    expect(screen.getByText('Hoy')).toBeInTheDocument()
  })

  it('muestra "Ayer" para el gasto de ayer', () => {
    render(<ExpenseList expenses={[mockExpenses[1]]} categories={[cat]} onRefresh={jest.fn()} />)
    expect(screen.getByText('Ayer')).toBeInTheDocument()
  })

  it('muestra una fecha formateada para gastos anteriores', () => {
    render(<ExpenseList expenses={[mockExpenses[2]]} categories={[]} onRefresh={jest.fn()} />)
    // No debe decir "Hoy" ni "Ayer"
    expect(screen.queryByText('Hoy')).not.toBeInTheDocument()
    expect(screen.queryByText('Ayer')).not.toBeInTheDocument()
  })

  it('muestra los montos formateados en COP', () => {
    render(<ExpenseList expenses={mockExpenses} categories={[cat]} onRefresh={jest.fn()} />)
    expect(screen.getAllByText(/50\.?000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/15\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('llama a onRefresh después de eliminar un gasto', async () => {
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<ExpenseList expenses={mockExpenses} categories={[cat]} onRefresh={onRefresh} />)
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar|trash|delete/i })
    await user.click(deleteButtons[0])
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })

  it('muestra estado vacío cuando no hay gastos', () => {
    render(<ExpenseList expenses={[]} categories={[]} onRefresh={jest.fn()} />)
    expect(screen.getByText(/sin gastos/i)).toBeInTheDocument()
  })

  it('en modo compact solo muestra los primeros gastos sin edición', () => {
    render(<ExpenseList expenses={mockExpenses} categories={[cat]} onRefresh={jest.fn()} compact />)
    // En modo compact no hay botones de eliminar
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
  })
})
