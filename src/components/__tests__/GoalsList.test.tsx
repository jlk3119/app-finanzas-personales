/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalsList from '../GoalsList'
import { createClient } from '@/utils/supabase/client'
import type { Goal, Category } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const mockCategories: Category[] = [
  { id: 'cat-1', user_id: 'u1', name: 'Fondo Emergencias', icon: '🏦', color: '#6366f1', is_system: false, parent_id: null, created_at: '' },
  { id: 'cat-2', user_id: 'u1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' },
]

const mockGoals: Goal[] = [
  { id: 'goal-1', user_id: 'u1', name: 'Fondo de emergencias', target_amount: 6_000_000, current_amount: 0, deadline: null, icon: '🏦', completed: false, category_id: 'cat-1', created_at: '', categories: mockCategories[0] },
  { id: 'goal-2', user_id: 'u1', name: 'Viaje a la playa', target_amount: 2_000_000, current_amount: 2_000_000, deadline: null, icon: '✈️', completed: true, category_id: null, created_at: '' },
]

function makeMock() {
  const mockGoalsEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockGoalsUpdate = jest.fn().mockReturnValue({ eq: mockGoalsEq })
  const mockExpensesInsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockGoalsInsert = jest.fn().mockResolvedValue({ data: null, error: null })

  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'goals') return { update: mockGoalsUpdate, insert: mockGoalsInsert }
      if (table === 'expenses') return { insert: mockExpensesInsert }
      return { insert: jest.fn(), update: jest.fn().mockReturnValue({ eq: jest.fn() }) }
    }),
  } as any)

  return { mockGoalsUpdate, mockGoalsEq, mockExpensesInsert }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('GoalsList', () => {
  it('renderiza las metas con nombre y progreso', () => {
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    expect(screen.getByText('Fondo de emergencias')).toBeInTheDocument()
    expect(screen.getByText('Viaje a la playa')).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0)
  })

  it('muestra la categoría vinculada en la meta', () => {
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    expect(screen.getByText(/fondo emergencias/i)).toBeInTheDocument()
  })

  it('muestra "Agregar ahorro" solo en metas incompletas', () => {
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    const buttons = screen.getAllByRole('button', { name: /agregar ahorro/i })
    expect(buttons).toHaveLength(1) // solo la meta incompleta
  })

  it('muestra badge "Completada" en metas completadas', () => {
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    expect(screen.getByText('Completada')).toBeInTheDocument()
  })

  it('abre el formulario de ahorro al hacer clic en "Agregar ahorro"', async () => {
    const user = userEvent.setup()
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /agregar ahorro/i }))
    expect(screen.getByPlaceholderText(/monto a ahorrar/i)).toBeInTheDocument()
  })

  it('la categoría fuente se preselecciona según la meta', async () => {
    const user = userEvent.setup()
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /agregar ahorro/i }))
    const selects = document.querySelectorAll('select')
    const select = selects[selects.length - 1] as HTMLSelectElement
    expect(select.value).toBe('cat-1')
  })

  it('actualiza la meta y crea un gasto cuando se guarda con categoría', async () => {
    const { mockGoalsUpdate, mockExpensesInsert } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /agregar ahorro/i }))
    await user.type(screen.getByPlaceholderText(/monto a ahorrar/i), '100000')
    await user.click(screen.getByRole('button', { name: /guardar ahorro/i }))
    await waitFor(() => {
      expect(mockGoalsUpdate).toHaveBeenCalled()
      expect(mockExpensesInsert).toHaveBeenCalled()
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('solo actualiza la meta cuando se guarda sin categoría', async () => {
    const { mockGoalsUpdate, mockExpensesInsert } = makeMock()
    const user = userEvent.setup()
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /agregar ahorro/i }))
    // Quitar la categoría seleccionada
    const selects = document.querySelectorAll('select')
    const select = selects[selects.length - 1] as HTMLSelectElement
    await user.selectOptions(select, '')
    await user.type(screen.getByPlaceholderText(/monto a ahorrar/i), '100000')
    await user.click(screen.getByRole('button', { name: /guardar ahorro/i }))
    await waitFor(() => {
      expect(mockGoalsUpdate).toHaveBeenCalled()
      expect(mockExpensesInsert).not.toHaveBeenCalled()
    })
  })

  it('muestra estado vacío cuando no hay metas', () => {
    render(<GoalsList goals={[]} categories={[]} onRefresh={jest.fn()} />)
    expect(screen.getByText(/sin metas financieras/i)).toBeInTheDocument()
  })

  it('llama a onRefresh después de eliminar una meta', async () => {
    const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
    mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ delete: mockDelete }) } as any)
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<GoalsList goals={mockGoals} categories={mockCategories} onRefresh={onRefresh} />)
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar|trash|delete/i })
    await user.click(deleteButtons[0])
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })
})
