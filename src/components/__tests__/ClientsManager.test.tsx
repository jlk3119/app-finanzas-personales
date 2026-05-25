/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClientsManager from '../ClientsManager'
import { createClient } from '@/utils/supabase/client'
import type { Client } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const clients: Client[] = [
  { id: 'c1', company_id: 'company-1', name: 'Tienda La Esquina', contact_name: 'María', email: 'maria@tienda.com', phone: '3001234567', notes: null, created_at: '' },
  { id: 'c2', company_id: 'company-1', name: 'Distribuidora XYZ', contact_name: null, email: null, phone: null, notes: 'Cliente frecuente', created_at: '' },
  { id: 'c3', company_id: 'company-1', name: 'Supermercado Central', contact_name: 'Pedro', email: null, phone: '3109876543', notes: null, created_at: '' },
  { id: 'c4', company_id: 'company-1', name: 'Panadería Don Luis', contact_name: null, email: null, phone: null, notes: null, created_at: '' },
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

describe('ClientsManager', () => {
  it('renderiza la lista de clientes', () => {
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText('Tienda La Esquina')).toBeInTheDocument()
    expect(screen.getByText('Distribuidora XYZ')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay clientes', () => {
    render(<ClientsManager clients={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/sin clientes/i)).toBeInTheDocument()
  })

  it('muestra campo de búsqueda cuando hay más de 3 clientes', () => {
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument()
  })

  it('filtra clientes por búsqueda', async () => {
    const user = userEvent.setup()
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.type(screen.getByPlaceholderText(/buscar/i), 'Tienda')
    expect(screen.getByText('Tienda La Esquina')).toBeInTheDocument()
    expect(screen.queryByText('Distribuidora XYZ')).not.toBeInTheDocument()
  })

  it('abre el formulario al hacer clic en Nuevo cliente', async () => {
    const user = userEvent.setup()
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nuevo cliente/i }))
    expect(screen.getByText(/nuevo cliente/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('el botón Crear cliente está deshabilitado con nombre vacío', async () => {
    const user = userEvent.setup()
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nuevo cliente/i }))
    expect(screen.getByRole('button', { name: /crear cliente/i })).toBeDisabled()
  })

  it('llama a insert al guardar un cliente nuevo', async () => {
    const { mockInsert } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /nuevo cliente/i }))
    await user.type(screen.getByPlaceholderText(/Tienda La Esquina/i), 'Nuevo Distribuidor')
    await user.click(screen.getByRole('button', { name: /crear cliente/i }))
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nuevo Distribuidor', company_id: 'company-1' }))
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('abre el formulario de edición al hacer clic en el lápiz', async () => {
    const user = userEvent.setup()
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    await user.click(editButtons[0])
    expect(screen.getByText(/editar cliente/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('rellena el formulario con los datos del cliente al editar', async () => {
    const user = userEvent.setup()
    render(<ClientsManager clients={[clients[0]]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /editar/i }))
    expect(screen.getByDisplayValue('Tienda La Esquina')).toBeInTheDocument()
    expect(screen.getByDisplayValue('María')).toBeInTheDocument()
  })

  it('llama a update al guardar edición de cliente', async () => {
    const { mockUpdate } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<ClientsManager clients={[clients[0]]} companyId="company-1" role="owner" onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /editar/i }))
    const nameInput = screen.getByDisplayValue('Tienda La Esquina')
    await user.clear(nameInput)
    await user.type(nameInput, 'Tienda Renovada')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tienda Renovada' }))
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('llama a onRefresh después de eliminar un cliente (owner)', async () => {
    const { mockEq } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={onRefresh} />)
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
    render(<ClientsManager clients={clients} companyId="company-1" role="employee" onRefresh={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
  })

  it('muestra botones de editar para employee', () => {
    render(<ClientsManager clients={clients} companyId="company-1" role="employee" onRefresh={jest.fn()} />)
    expect(screen.getAllByRole('button', { name: /editar/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('abre el formulario cuando onRequestNew cambia de 0 a 1', async () => {
    const { rerender } = render(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} onRequestNew={0} />)
    expect(screen.queryByText(/nuevo cliente/i, { selector: 'p' })).not.toBeInTheDocument()
    rerender(<ClientsManager clients={clients} companyId="company-1" role="owner" onRefresh={jest.fn()} onRequestNew={1} />)
    expect(await screen.findByText(/nuevo cliente/i, { selector: 'p' })).toBeInTheDocument()
  })
})
