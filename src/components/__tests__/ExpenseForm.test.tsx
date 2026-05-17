/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseForm from '../ExpenseForm'
import { createClient } from '@/utils/supabase/client'
import type { Category } from '@/types'

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
  const supabase = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockReturnValue({ insert: mockInsert }),
  }
  mockCreateClient.mockReturnValue(supabase as any)
  return { mockInsert, supabase }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('ExpenseForm', () => {
  it('renderiza el formulario con los campos requeridos', () => {
    render(<ExpenseForm categories={mockCategories} onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar gasto/i })).toBeInTheDocument()
  })

  it('muestra las categorías padre como botones', () => {
    render(<ExpenseForm categories={mockCategories} onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByText(/alimentación/i)).toBeInTheDocument()
    expect(screen.getByText(/transporte/i)).toBeInTheDocument()
  })

  it('muestra subcategorías al seleccionar una categoría padre con hijos', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={mockCategories} onClose={jest.fn()} onSaved={jest.fn()} />)
    // Alimentación tiene subcategorías, aparece con "›"
    await user.click(screen.getByText(/alimentación/i))
    expect(screen.getByText(/mercado/i)).toBeInTheDocument()
    expect(screen.getByText(/restaurante/i)).toBeInTheDocument()
  })

  it('no muestra subcategorías para categorías sin hijos', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={mockCategories} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.click(screen.getByText(/transporte/i))
    expect(screen.queryByText(/mercado/i)).not.toBeInTheDocument()
  })

  it('muestra error de validación cuando el monto está vacío', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    expect(screen.getByText(/monto válido/i)).toBeInTheDocument()
  })

  it('muestra error de validación cuando el monto es cero', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '0')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    expect(screen.getByText(/monto válido/i)).toBeInTheDocument()
  })

  it('llama a onSaved después de guardar exitosamente', async () => {
    const onSaved = jest.fn()
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} onClose={jest.fn()} onSaved={onSaved} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('muestra mensaje de error si Supabase retorna error', async () => {
    makeMock({ data: null, error: { message: 'Error de conexión' } as any })
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))
    await waitFor(() => expect(screen.getByText(/error de conexión/i)).toBeInTheDocument())
  })

  it('llama a onClose al presionar Cancelar', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} onClose={onClose} onSaved={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('deshabilita el botón submit mientras guarda', async () => {
    const { mockInsert } = makeMock()
    // Bloquear la promesa para observar el estado de carga
    let resolveInsert!: (v: any) => void
    mockInsert.mockReturnValue(new Promise((res) => { resolveInsert = res }))

    const user = userEvent.setup()
    render(<ExpenseForm categories={[]} onClose={jest.fn()} onSaved={jest.fn()} />)
    await user.type(screen.getByLabelText(/monto/i), '50000')
    await user.click(screen.getByRole('button', { name: /guardar gasto/i }))

    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()
    resolveInsert({ data: null, error: null })
  })
})
