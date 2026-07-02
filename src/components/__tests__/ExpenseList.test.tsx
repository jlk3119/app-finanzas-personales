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
  { id: 'e1', user_id: 'u1', category_id: 'cat-1', account_id: 'acc-1', amount: 50000, description: 'Supermercado', date: today, created_at: '', categories: cat },
  { id: 'e2', user_id: 'u1', category_id: 'cat-1', account_id: null, amount: 15000, description: 'Bus', date: yesterday, created_at: '', categories: cat },
  { id: 'e3', user_id: 'u1', category_id: null, account_id: null, amount: 8000, description: 'Café', date: '2020-03-10', created_at: '' },
]

function makeDeleteMock() {
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
  const updateChainable: any = { eq: jest.fn().mockResolvedValue({ data: null, error: null }) }
  const mockUpdate = jest.fn().mockReturnValue(updateChainable)
  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null })
  mockCreateClient.mockReturnValue({ from: jest.fn().mockReturnValue({ delete: mockDelete, update: mockUpdate }), rpc: mockRpc } as any)
  return { mockDelete, mockEq, mockRpc }
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

  it('renderiza todos los gastos con movimiento reducido (sin perder contenido)', () => {
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
    await user.click(screen.getAllByRole('button', { name: /^eliminar$/i })[0])
    await user.click(await screen.findByText('Eliminar', { selector: 'button' }))
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

  it('muestra botón editar cuando se provee onEdit', () => {
    render(<ExpenseList expenses={mockExpenses} categories={[cat]} onRefresh={jest.fn()} onEdit={jest.fn()} />)
    expect(screen.getAllByRole('button', { name: /editar/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('llama a onEdit con el gasto correcto al hacer clic en editar', async () => {
    const onEdit = jest.fn()
    const user = userEvent.setup()
    render(<ExpenseList expenses={[mockExpenses[0]]} categories={[cat]} onRefresh={jest.fn()} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: /editar/i }))
    expect(onEdit).toHaveBeenCalledWith(mockExpenses[0])
  })

  it('no muestra botón editar cuando no se provee onEdit', () => {
    render(<ExpenseList expenses={mockExpenses} categories={[cat]} onRefresh={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  it('restaura el saldo de la cuenta vinculada al eliminar un gasto', async () => {
    const { mockRpc } = makeDeleteMock()
    const user = userEvent.setup()
    render(<ExpenseList expenses={[mockExpenses[0]]} categories={[cat]} onRefresh={jest.fn()} />)
    await user.click(screen.getAllByRole('button', { name: /^eliminar$/i })[0])
    await user.click(await screen.findByText('Eliminar', { selector: 'button' }))
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('increment_balance', {
      p_account_id: 'acc-1', p_delta: 50000, p_clamp_zero: false,
    }))
  })

  it('no actualiza el saldo si el gasto no tiene cuenta vinculada', async () => {
    const { mockRpc } = makeDeleteMock()
    const user = userEvent.setup()
    // expense sin account_id
    render(<ExpenseList expenses={[mockExpenses[1]]} categories={[cat]} onRefresh={jest.fn()} />)
    await user.click(screen.getAllByRole('button', { name: /^eliminar$/i })[0])
    await user.click(await screen.findByText('Eliminar', { selector: 'button' }))
    await waitFor(() => expect(screen.queryByText('Eliminar', { selector: 'button' })).not.toBeInTheDocument())
    expect(mockRpc).not.toHaveBeenCalled()
  })

  describe('filtro por categoría y subcategoría', () => {
    const transporte: Category = { id: 'tr', user_id: 'u1', name: 'Transporte', icon: '🚌', color: '#3b82f6', is_system: false, parent_id: null, created_at: '' }
    const bus: Category = { id: 'tr-bus', user_id: 'u1', name: 'Bus', icon: '🚌', color: '#3b82f6', is_system: false, parent_id: 'tr', created_at: '' }
    const taxi: Category = { id: 'tr-taxi', user_id: 'u1', name: 'Taxi', icon: '🚕', color: '#3b82f6', is_system: false, parent_id: 'tr', created_at: '' }
    const cats = [cat, transporte, bus, taxi]
    const exps: Expense[] = [
      { id: 'a', user_id: 'u1', category_id: 'cat-1', account_id: null, amount: 50000, description: 'Mercado', date: today, created_at: '', categories: cat },
      { id: 'b', user_id: 'u1', category_id: 'tr-bus', account_id: null, amount: 3000, description: 'Pasaje bus', date: today, created_at: '', categories: bus },
      { id: 'c', user_id: 'u1', category_id: 'tr-taxi', account_id: null, amount: 12000, description: 'Carrera taxi', date: today, created_at: '', categories: taxi },
    ]

    it('muestra todos los gastos por defecto', () => {
      render(<ExpenseList expenses={exps} categories={cats} onRefresh={jest.fn()} />)
      expect(screen.getByText('Mercado')).toBeInTheDocument()
      expect(screen.getByText('Pasaje bus')).toBeInTheDocument()
      expect(screen.getByText('Carrera taxi')).toBeInTheDocument()
    })

    it('filtra por categoría padre incluyendo sus subcategorías', async () => {
      const user = userEvent.setup()
      render(<ExpenseList expenses={exps} categories={cats} onRefresh={jest.fn()} />)
      await user.click(screen.getByRole('button', { name: /🚌 Transporte/ }))
      expect(screen.queryByText('Mercado')).not.toBeInTheDocument()
      expect(screen.getByText('Pasaje bus')).toBeInTheDocument()
      expect(screen.getByText('Carrera taxi')).toBeInTheDocument()
    })

    it('filtra por subcategoría específica', async () => {
      const user = userEvent.setup()
      render(<ExpenseList expenses={exps} categories={cats} onRefresh={jest.fn()} />)
      await user.click(screen.getByRole('button', { name: /🚌 Transporte/ }))
      await user.click(screen.getByRole('button', { name: /🚕 Taxi/ }))
      expect(screen.getByText('Carrera taxi')).toBeInTheDocument()
      expect(screen.queryByText('Pasaje bus')).not.toBeInTheDocument()
      expect(screen.queryByText('Mercado')).not.toBeInTheDocument()
    })

    it('muestra mensaje cuando no hay gastos en la categoría filtrada', async () => {
      const soloMercado: Expense[] = [exps[0]]
      const user = userEvent.setup()
      render(<ExpenseList expenses={soloMercado} categories={cats} onRefresh={jest.fn()} />)
      await user.click(screen.getByRole('button', { name: /🚌 Transporte/ }))
      expect(screen.getByText(/sin gastos en esta categoría/i)).toBeInTheDocument()
    })
  })
})
