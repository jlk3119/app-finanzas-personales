/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseForm from '../ExpenseForm'
import { createClient } from '@/utils/supabase/client'
import type { Account, Category, Expense } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const mockCategories: Category[] = [
  { id: 'cat-1', user_id: 'u1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' },
  { id: 'cat-1a', user_id: 'u1', name: 'Mercado', icon: '🛒', color: '#f59e0b', is_system: false, parent_id: 'cat-1', created_at: '' },
  { id: 'cat-1b', user_id: 'u1', name: 'Restaurante', icon: '🍕', color: '#f59e0b', is_system: false, parent_id: 'cat-1', created_at: '' },
  { id: 'cat-2', user_id: 'u1', name: 'Transporte', icon: '🚌', color: '#3b82f6', is_system: false, parent_id: null, created_at: '' },
]

function makeMock(insertResult = { data: null, error: null }) {
  const mockInsert = jest.fn().mockResolvedValue(insertResult)
  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null })
  const chainable: any = {}
  ;['eq'].forEach((m) => { chainable[m] = jest.fn().mockResolvedValue({ data: null, error: null }) })
  const supabase = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockReturnValue({ insert: mockInsert, update: jest.fn().mockReturnValue(chainable) }),
    rpc: mockRpc,
  }
  mockCreateClient.mockReturnValue(supabase as any)
  return { mockInsert, mockRpc, supabase }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('ExpenseForm', () => {
  it('renderiza el formulario con los campos requeridos', () => {
    render(<ExpenseForm categories={mockCategories} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar gasto/i })).toBeInTheDocument()
  })

  it('muestra las categorías padre como botones', () => {
    render(<ExpenseForm categories={mockCategories} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByText(/alimentación/i)).toBeInTheDocument()
    expect(screen.getByText(/transporte/i)).toBeInTheDocument()
  })

  it('muestra subcategorías al seleccionar una categoría padre con hijos', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={mockCategories} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    // Alimentación tiene subcategorías, aparece con "›"
    await user.click(screen.getByText(/alimentación/i))
    expect(screen.getByText(/mercado/i)).toBeInTheDocument()
    expect(screen.getByText(/restaurante/i)).toBeInTheDocument()
  })

  it('no muestra subcategorías para categorías sin hijos', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={mockCategories} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.click(screen.getByText(/transporte/i))
    expect(screen.queryByText(/mercado/i)).not.toBeInTheDocument()
  })

  it('muestra error de validación cuando el monto está vacío', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    expect(screen.getByText(/monto válido/i)).toBeInTheDocument()
  })

  it('muestra error de validación cuando el monto es cero', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '0')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    expect(screen.getByText(/monto válido/i)).toBeInTheDocument()
  })

  it('llama a onSaved después de guardar exitosamente', async () => {
    const onSaved = jest.fn()
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} onClose={jest.fn()} onSaved={onSaved} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('muestra mensaje de error si Supabase retorna error', async () => {
    makeMock({ data: null, error: { message: 'Error de conexión' } as any })
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    await waitFor(() => expect(screen.getByText(/no se pudo guardar el gasto/i)).toBeInTheDocument())
  })

  it('llama a onClose al presionar Cancelar', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} onClose={onClose} onSaved={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('inicializa la fecha con la fecha local del dispositivo (no UTC)', () => {
    render(<ExpenseForm categories={[]} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement
    const today = new Date()
    const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(dateInput.value).toBe(expectedDate)
  })

  it('pre-selecciona la cuenta si solo hay una disponible', () => {
    const mockAccount: Account = { id: 'acc-1', user_id: 'u1', name: 'Nequi', balance: 300000, icon: '📱', color: '#6366f1', created_at: '' }
    render(<ExpenseForm categories={[]} accounts={[mockAccount]} onClose={jest.fn()} onSaved={jest.fn()} />)
    const accountBtn = screen.getByRole('button', { name: /nequi/i })
    expect(accountBtn).toHaveClass('border-primary')
  })

  it('selecciona una cuenta al hacer clic cuando hay varias', async () => {
    const acc1: Account = { id: 'acc-1', user_id: 'u1', name: 'Nequi', balance: 300000, icon: '📱', color: '#6366f1', created_at: '' }
    const acc2: Account = { id: 'acc-2', user_id: 'u1', name: 'Bancolombia', balance: 100000, icon: '🏦', color: '#3b82f6', created_at: '' }
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[acc1, acc2]} onClose={jest.fn()} onSaved={jest.fn()} />)
    const acc2Btn = screen.getByRole('button', { name: /bancolombia/i })
    expect(acc2Btn).not.toHaveClass('border-primary')
    await user.click(acc2Btn)
    expect(acc2Btn).toHaveClass('border-primary')
  })

  it('descuenta el gasto del saldo de la cuenta seleccionada', async () => {
    const mockAccount: Account = { id: 'acc-1', user_id: 'u1', name: 'Nequi', balance: 300000, icon: '📱', color: '#6366f1', created_at: '' }
    const { mockRpc } = makeMock()
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[mockAccount]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    // Nequi es la única cuenta — se pre-selecciona automáticamente
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('increment_balance', {
      p_account_id: 'acc-1', p_delta: -50000, p_clamp_zero: true,
    }))
  })

  it('en modo edición muestra el título "Editar gasto" y pre-llena los campos', () => {
    const expense: Expense = {
      id: 'e1', user_id: 'u1', category_id: null, account_id: null,
      amount: 75000, description: 'Almuerzo', date: '2026-05-10', created_at: '',
    }
    render(<ExpenseForm categories={[]} accounts={[]} editingExpense={expense} onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByText(/editar gasto/i)).toBeInTheDocument()
    expect((screen.getByLabelText(/monto/i) as HTMLInputElement).value).toBe('75000')
    expect((screen.getByLabelText(/descripción/i) as HTMLInputElement).value).toBe('Almuerzo')
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument()
  })

  it('en modo edición llama a update en lugar de insert', async () => {
    const expense: Expense = {
      id: 'e1', user_id: 'u1', category_id: null, account_id: null,
      amount: 50000, description: 'Bus', date: '2026-05-10', created_at: '',
    }
    const { supabase } = makeMock()
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) })
    ;(supabase.from as jest.Mock).mockImplementation(() => ({ update: mockUpdate, insert: jest.fn() }))
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} editingExpense={expense} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
  })

  it('deshabilita el botón submit mientras guarda', async () => {
    const { mockInsert } = makeMock()
    // Bloquear la promesa para observar el estado de carga
    let resolveInsert!: (v: any) => void
    mockInsert.mockReturnValue(new Promise((res) => { resolveInsert = res }))

    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} accounts={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))

    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()
    resolveInsert({ data: null, error: null })
  })
})
