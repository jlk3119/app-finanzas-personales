/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetManager from '../BudgetManager'
import { createClient } from '@/utils/supabase/client'
import type { Budget, Category, Account, RecurringIncome } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const cats: Category[] = [
  { id: 'cat-1', user_id: 'u1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' },
  { id: 'cat-1a', user_id: 'u1', name: 'Mercado', icon: '🛒', color: '#f59e0b', is_system: false, parent_id: 'cat-1', created_at: '' },
  { id: 'cat-1b', user_id: 'u1', name: 'Restaurante', icon: '🍕', color: '#f59e0b', is_system: false, parent_id: 'cat-1', created_at: '' },
  { id: 'cat-2', user_id: 'u1', name: 'Transporte', icon: '🚌', color: '#3b82f6', is_system: false, parent_id: null, created_at: '' },
]

const budgets: Budget[] = [
  { id: 'bud-1', user_id: 'u1', category_id: 'cat-1', period: 'monthly', amount: 300_000, year: 2026, month: 5, week: null, created_at: '', categories: cats[0] },
  { id: 'bud-2', user_id: 'u1', category_id: null, period: 'monthly', amount: 2_000_000, year: 2026, month: 5, week: null, created_at: '' },
]

const defaultProps = {
  budgets,
  categories: cats,
  accounts: [] as Account[],
  recurringIncome: [] as RecurringIncome[],
  onRefresh: jest.fn(),
  onManageCategories: jest.fn(),
  currentMonth: 5,
  currentYear: 2026,
  currentWeek: 20,
}

function makeMock() {
  const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
  const mockDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) })
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockReturnValue({ upsert: mockUpsert, update: mockUpdate, delete: mockDelete }),
  } as any)
  return { mockUpsert, mockUpdate, mockEq }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('BudgetManager', () => {
  it('renderiza los presupuestos existentes', () => {
    render(<BudgetManager {...defaultProps} />)
    expect(screen.getByText('Alimentación')).toBeInTheDocument()
    expect(screen.getByText('Total general')).toBeInTheDocument()
  })

  it('muestra el monto de presupuesto formateado', () => {
    render(<BudgetManager {...defaultProps} />)
    expect(screen.getAllByText(/300\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('abre el formulario al hacer clic en "Agregar presupuesto"', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    expect(screen.getByText(/nuevo presupuesto/i)).toBeInTheDocument()
  })

  it('cancela el formulario al hacer clic en Cancelar', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.queryByText(/nuevo presupuesto/i)).not.toBeInTheDocument()
  })

  it('muestra subcategorías cuando se selecciona una categoría padre con hijos', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    // The form has two selects: period selector and category selector (last)
    const selects = screen.getAllByTestId('select')
    const categorySelect = selects[selects.length - 1] as HTMLSelectElement
    await user.selectOptions(categorySelect, 'cat-1')
    expect(screen.getAllByText(/montos por subcategor/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/mercado/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/restaurante/i).length).toBeGreaterThanOrEqual(1)
  })

  it('no muestra subcategorías para categorías sin hijos', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    const selects = screen.getAllByTestId('select')
    const categorySelect = selects[selects.length - 1] as HTMLSelectElement
    await user.selectOptions(categorySelect, 'cat-2')
    expect(screen.queryByText(/subcategorías/i)).not.toBeInTheDocument()
  })

  it('abre el formulario de edición con los datos precargados', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    const editButtons = screen.getAllByRole('button', { name: /editar|pencil/i })
    // Usar el último botón editar (bud-2, global sin subcategorías) que siempre muestra el campo de monto
    await user.click(editButtons[editButtons.length - 1])
    expect(screen.getByText(/editar presupuesto/i)).toBeInTheDocument()
    expect((screen.getAllByPlaceholderText('0')[0] as HTMLInputElement).value).toBe('2000000')
  })

  it('preselecciona subcategorías existentes al editar', async () => {
    const budgetsWithSub: Budget[] = [
      ...budgets,
      { id: 'bud-3', user_id: 'u1', category_id: 'cat-1a', period: 'monthly', amount: 150_000, year: 2026, month: 5, week: null, created_at: '' },
    ]
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} budgets={budgetsWithSub} />)
    const editButtons = screen.getAllByRole('button', { name: /editar|pencil/i })
    await user.click(editButtons[0]) // editar Alimentación
    // El input de Mercado debe estar prellenado con 150000
    const inputs = screen.getAllByPlaceholderText('0') as HTMLInputElement[]
    const mercadoInput = inputs.find((i) => i.value === '150000')
    expect(mercadoInput).toBeDefined()
  })

  it('guarda el presupuesto principal y los sub-presupuestos', async () => {
    const { mockUpsert } = makeMock()
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    const selects = screen.getAllByTestId('select')
    const select = selects[selects.length - 1] as HTMLSelectElement
    await user.selectOptions(select, 'cat-1')
    const inputs = screen.getAllByPlaceholderText('0') as HTMLInputElement[]
    await user.type(inputs[0], '300000') // monto principal
    await user.type(inputs[1], '200000') // mercado
    await user.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => {
      // upsert llamado al menos dos veces: una por el principal, una por la subcategoría
      expect(mockUpsert.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('llama a onManageCategories al hacer clic en "Gestionar categorías"', async () => {
    const onManageCategories = jest.fn()
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} onManageCategories={onManageCategories} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    await user.click(screen.getByRole('button', { name: /gestionar categorías/i }))
    expect(onManageCategories).toHaveBeenCalledTimes(1)
  })
})
