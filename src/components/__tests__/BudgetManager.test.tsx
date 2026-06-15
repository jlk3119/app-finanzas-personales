/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetManager from '../BudgetManager'
import { createClient } from '@/utils/supabase/client'
import type { Budget, Category, Account, RecurringIncome, Income } from '@/types'

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
  income: [] as Income[],
  onRefresh: jest.fn(),
  onManageCategories: jest.fn(),
  currentMonth: 5,
  currentYear: 2026,
  currentWeek: 20,
}

function makeMock() {
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
  // Chainable delete mock: each method returns an object with all filter methods + resolves at the end
  const chainable: any = { data: null, error: null }
  const methods = ['eq', 'is', 'in', 'neq', 'gt', 'lt']
  methods.forEach((m) => { chainable[m] = jest.fn().mockReturnValue(chainable) })
  Object.assign(chainable, { then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve) })
  const mockDelete = jest.fn().mockReturnValue(chainable)
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockReturnValue({ insert: mockInsert, upsert: mockUpsert, update: mockUpdate, delete: mockDelete }),
  } as any)
  return { mockInsert, mockUpsert, mockUpdate, mockEq }
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
    const { mockInsert } = makeMock()
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    const selects = screen.getAllByTestId('select')
    const select = selects[selects.length - 1] as HTMLSelectElement
    await user.selectOptions(select, 'cat-1')
    const inputs = screen.getAllByPlaceholderText('0') as HTMLInputElement[]
    await user.type(inputs[0], '300000') // mercado
    await user.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => {
      // insert llamado al menos dos veces: padre + subcategorías
      expect(mockInsert.mock.calls.length).toBeGreaterThanOrEqual(2)
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

describe('BudgetManager — isRootBudget y doble conteo', () => {
  it('no suma sub-presupuestos al Total presupuestado', () => {
    const budgetsWithSub: Budget[] = [
      ...budgets,
      { id: 'bud-3', user_id: 'u1', category_id: 'cat-1a', period: 'monthly', amount: 150_000, year: 2026, month: 5, week: null, created_at: '' },
    ]
    render(<BudgetManager {...defaultProps} budgets={budgetsWithSub} />)
    // Total = bud-1 (300k) + bud-2 (2M) = 2.300.000; NO 2.450.000 (que incluiría sub)
    expect(screen.getAllByText(/2\.300\.000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText(/2\.450\.000/).length).toBe(0)
  })

  it('muestra la fila "Otros" cuando el padre tiene más presupuesto que sus subcategorías', () => {
    const budgetsWithSub: Budget[] = [
      { id: 'bud-1', user_id: 'u1', category_id: 'cat-1', period: 'monthly', amount: 300_000, year: 2026, month: 5, week: null, created_at: '', categories: cats[0] },
      { id: 'bud-3', user_id: 'u1', category_id: 'cat-1a', period: 'monthly', amount: 200_000, year: 2026, month: 5, week: null, created_at: '' },
    ]
    render(<BudgetManager {...defaultProps} budgets={budgetsWithSub} />)
    // othersAmt = 300k - 200k = 100k → debe mostrar fila "Otros" con 100.000
    expect(screen.getByText('Otros')).toBeInTheDocument()
    expect(screen.getAllByText(/100\.000/).length).toBeGreaterThanOrEqual(1)
  })

  it('no muestra la fila "Otros" cuando el padre está totalmente distribuido', () => {
    const budgetsExact: Budget[] = [
      { id: 'bud-1', user_id: 'u1', category_id: 'cat-1', period: 'monthly', amount: 300_000, year: 2026, month: 5, week: null, created_at: '', categories: cats[0] },
      { id: 'bud-3', user_id: 'u1', category_id: 'cat-1a', period: 'monthly', amount: 300_000, year: 2026, month: 5, week: null, created_at: '' },
    ]
    render(<BudgetManager {...defaultProps} budgets={budgetsExact} />)
    expect(screen.queryByText('Otros')).not.toBeInTheDocument()
  })
})

describe('BudgetManager — campo Otros en formulario', () => {
  it('precarga el campo Otros con el remanente al editar un presupuesto con sub-presupuestos', async () => {
    const budgetsWithSub: Budget[] = [
      ...budgets,
      { id: 'bud-3', user_id: 'u1', category_id: 'cat-1a', period: 'monthly', amount: 200_000, year: 2026, month: 5, week: null, created_at: '' },
    ]
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} budgets={budgetsWithSub} />)
    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    await user.click(editButtons[0]) // editar Alimentación (cat-1, 300k)
    // Otros = 300k − 200k (Mercado) = 100k
    const inputs = screen.getAllByPlaceholderText('0') as HTMLInputElement[]
    const othersInput = inputs.find((i) => i.value === '100000')
    expect(othersInput).toBeDefined()
  })

  it('muestra el botón "Agregar subcategoría" cuando se selecciona una categoría con hijos', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    const selects = screen.getAllByTestId('select')
    const categorySelect = selects[selects.length - 1] as HTMLSelectElement
    await user.selectOptions(categorySelect, 'cat-1')
    expect(screen.getByRole('button', { name: /agregar subcategor/i })).toBeInTheDocument()
  })

  it('despliega el formulario inline al hacer clic en "Agregar subcategoría"', async () => {
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    const selects = screen.getAllByTestId('select')
    await user.selectOptions(selects[selects.length - 1] as HTMLSelectElement, 'cat-1')
    await user.click(screen.getByRole('button', { name: /agregar subcategor/i }))
    expect(screen.getByPlaceholderText(/nueva subcategor/i)).toBeInTheDocument()
  })

  it('elimina una subcategoría desde el panel de montos tras confirmar', async () => {
    const onRefresh = jest.fn()
    const deleteEq = jest.fn().mockResolvedValue({ data: null, error: null })
    const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq })
    mockCreateClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }),
        delete: deleteFn,
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const user = userEvent.setup()
    render(<BudgetManager {...defaultProps} onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /agregar presupuesto/i }))
    const selects = screen.getAllByTestId('select')
    await user.selectOptions(selects[selects.length - 1] as HTMLSelectElement, 'cat-1')
    await user.click(screen.getByRole('button', { name: /eliminar subcategoría mercado/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))
    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalled()
      expect(deleteEq).toHaveBeenCalledWith('id', 'cat-1a')
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('permite planear hasta diciembre del año en curso y bloquea el año siguiente', async () => {
    const user = userEvent.setup()
    const { container } = render(<BudgetManager {...defaultProps} currentMonth={5} currentYear={2026} />)
    const nextBtn = () => container.querySelector('.lucide-chevron-right')?.closest('button') as HTMLButtonElement
    // Desde Mayo 2026, avanzar mes a mes hasta Diciembre 2026.
    for (let i = 0; i < 7; i++) {
      expect(nextBtn()).not.toBeDisabled()
      await user.click(nextBtn())
    }
    expect(screen.getByText(/Diciembre 2026/)).toBeInTheDocument()
    // En Diciembre 2026 el botón "siguiente" queda deshabilitado (no se planea 2027).
    expect(nextBtn()).toBeDisabled()
  })
})
