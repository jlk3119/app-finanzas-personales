/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrdersManager, { getDaysUntilDelivery } from '../OrdersManager'
import { createClient } from '@/utils/supabase/client'
import type { Order, Client } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = toLocalDateStr(new Date())
const future5 = toLocalDateStr(new Date(Date.now() + 5 * 86400000))
const future2 = toLocalDateStr(new Date(Date.now() + 2 * 86400000))
const past2 = toLocalDateStr(new Date(Date.now() - 2 * 86400000))

const mockClient: Client = {
  id: 'client-1', company_id: 'company-1', name: 'Tienda La Esquina',
  contact_name: null, email: null, phone: null, notes: null, created_at: '',
}

const mockOrders: Order[] = [
  {
    id: 'o1', company_id: 'company-1', client_id: 'client-1',
    description: 'Camisetas bordadas', total_value: 500000, advance_payment: 100000,
    status: 'pending', order_date: today, delivery_date: future5, notes: null, created_at: '',
  },
  {
    id: 'o2', company_id: 'company-1', client_id: null,
    description: 'Bolsas personalizadas', total_value: 200000, advance_payment: 0,
    status: 'in_progress', order_date: today, delivery_date: future2, notes: null, created_at: '',
  },
  {
    id: 'o3', company_id: 'company-1', client_id: null,
    description: 'Pedido entregado', total_value: 150000, advance_payment: 150000,
    status: 'delivered', order_date: today, delivery_date: null, notes: null, created_at: '',
  },
]

function makeMock() {
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
  const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({ insert: mockInsert, update: mockUpdate, delete: mockDelete }),
  } as any)
  return { mockInsert, mockUpdate, mockDelete, mockEq }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('getDaysUntilDelivery', () => {
  it('retorna null para string vacío', () => {
    expect(getDaysUntilDelivery('')).toBeNull()
  })

  it('retorna 0 para fecha de hoy', () => {
    expect(getDaysUntilDelivery(today)).toBe(0)
  })

  it('retorna positivo para fechas futuras', () => {
    const result = getDaysUntilDelivery(future5)
    expect(result).toBeGreaterThan(0)
  })

  it('retorna negativo para fechas pasadas', () => {
    const result = getDaysUntilDelivery(past2)
    expect(result).toBeLessThan(0)
  })
})

describe('OrdersManager', () => {
  it('muestra los pedidos activos por defecto (pending + in_progress)', () => {
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText('Camisetas bordadas')).toBeInTheDocument()
    expect(screen.getByText('Bolsas personalizadas')).toBeInTheDocument()
    expect(screen.queryByText('Pedido entregado')).not.toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay pedidos', () => {
    render(<OrdersManager orders={[]} clients={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/sin pedidos/i)).toBeInTheDocument()
  })

  it('filtra pedidos por estado al cambiar el filtro', async () => {
    const user = userEvent.setup()
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /entregados/i }))
    expect(screen.getByText('Pedido entregado')).toBeInTheDocument()
    expect(screen.queryByText('Camisetas bordadas')).not.toBeInTheDocument()
  })

  it('muestra todos los pedidos con el filtro "Todos"', async () => {
    const user = userEvent.setup()
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /todos/i }))
    expect(screen.getByText('Camisetas bordadas')).toBeInTheDocument()
    expect(screen.getByText('Pedido entregado')).toBeInTheDocument()
  })

  it('muestra el badge de countdown verde para entregas con más de 3 días', () => {
    render(<OrdersManager orders={[mockOrders[0]]} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/restantes/i)).toBeInTheDocument()
  })

  it('muestra el badge de countdown naranja para entregas con 2 días o menos', () => {
    render(<OrdersManager orders={[mockOrders[1]]} clients={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/restantes|hoy/i)).toBeInTheDocument()
  })

  it('muestra badge rojo para pedido vencido', () => {
    const overdueOrder: Order = { ...mockOrders[0], id: 'o-late', delivery_date: past2 }
    render(<OrdersManager orders={[overdueOrder]} clients={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/venció/i)).toBeInTheDocument()
  })

  it('abre el formulario de nuevo pedido', async () => {
    const user = userEvent.setup()
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nuevo pedido/i }))
    expect(screen.getByText(/nuevo pedido/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('el botón Crear pedido está deshabilitado con descripción vacía', async () => {
    const user = userEvent.setup()
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nuevo pedido/i }))
    expect(screen.getByRole('button', { name: /crear pedido/i })).toBeDisabled()
  })

  it('llama a insert al guardar un pedido nuevo', async () => {
    const { mockInsert } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /nuevo pedido/i }))
    await user.type(screen.getByPlaceholderText(/50 unidades/i), 'Gorras bordadas')
    const [totalInput] = screen.getAllByPlaceholderText('0')
    await user.type(totalInput, '300000')
    await user.click(screen.getByRole('button', { name: /crear pedido/i }))
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ description: 'Gorras bordadas', company_id: 'company-1' }))
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('llama a update de estado al cambiar el estado del pedido', async () => {
    const { mockUpdate } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<OrdersManager orders={[mockOrders[0]]} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /iniciar/i }))
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'in_progress' })
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('llama a onRefresh después de eliminar (owner)', async () => {
    const { mockEq } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={onRefresh} />)
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
    await user.click(deleteButtons[0])
    const allDeleteBtns = await screen.findAllByRole('button', { name: /eliminar/i })
    await user.click(allDeleteBtns[allDeleteBtns.length - 1])
    await waitFor(() => {
      expect(mockEq).toHaveBeenCalled()
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('no muestra botones de eliminar para employee', () => {
    render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="employee" onRefresh={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
  })

  it('muestra botones de cambio de estado para employee', () => {
    render(<OrdersManager orders={[mockOrders[0]]} clients={[mockClient]} companyId="company-1" role="employee" onRefresh={jest.fn()} />)
    expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument()
  })

  it('abre el formulario cuando onRequestNew cambia', async () => {
    const { rerender } = render(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} onRequestNew={0} />)
    expect(screen.queryByText(/nuevo pedido/i, { selector: 'p' })).not.toBeInTheDocument()
    rerender(<OrdersManager orders={mockOrders} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} onRequestNew={1} />)
    expect(await screen.findByText(/nuevo pedido/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('muestra el nombre del cliente vinculado al pedido', () => {
    render(<OrdersManager orders={[mockOrders[0]]} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText('Tienda La Esquina')).toBeInTheDocument()
  })

  it('muestra el saldo por cobrar correctamente', () => {
    render(<OrdersManager orders={[mockOrders[0]]} clients={[mockClient]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    // total_value=500000, advance=100000, saldo=400000
    expect(screen.getAllByText(/400\.?000/).length).toBeGreaterThanOrEqual(1)
  })
})
