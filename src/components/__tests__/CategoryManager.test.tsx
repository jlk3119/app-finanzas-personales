/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryManager from '../CategoryManager'
import { createClient } from '@/utils/supabase/client'
import type { Category } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const categories: Category[] = [
  { id: 'cat-sys', company_id: 'company-1', name: 'Otros', icon: '📦', color: '#6b7280', is_system: true, parent_id: null, created_at: '' },
  { id: 'cat-1', company_id: 'company-1', name: 'Alimentación', icon: '🍽️', color: '#f59e0b', is_system: false, parent_id: null, created_at: '' },
  { id: 'cat-1a', company_id: 'company-1', name: 'Mercado', icon: '🛒', color: '#f59e0b', is_system: false, parent_id: 'cat-1', created_at: '' },
]

function makeMock() {
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
  const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
    from: jest.fn().mockReturnValue({ insert: mockInsert, update: mockUpdate, delete: mockDelete }),
  } as any)
  return { mockInsert, mockUpdate, mockDelete, mockEq }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('CategoryManager', () => {
  it('renderiza la lista de categorías', () => {
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    expect(screen.getByText('Alimentación')).toBeInTheDocument()
    expect(screen.getByText('Otros')).toBeInTheDocument()
  })

  it('muestra las subcategorías indentadas bajo su padre', () => {
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    expect(screen.getByText('Mercado')).toBeInTheDocument()
    // La subcategoría aparece con el indicador "↳"
    expect(screen.getByText('↳')).toBeInTheDocument()
  })

  it('las categorías de sistema muestran el indicador "Sistema"', () => {
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    expect(screen.getByText(/sistema/i)).toBeInTheDocument()
  })

  it('las categorías de sistema no tienen botón de eliminar', () => {
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    // La categoría de sistema no debe tener botón de eliminar
    // Las no-sistema sí tienen. Comprobamos por aria o data
    const trashButtons = screen.getAllByRole('button', { name: /eliminar|trash|delete/i })
    // cat-1 (padre) + cat-1a (hijo) = 2, cat-sys no tiene
    expect(trashButtons.length).toBe(2)
  })

  it('abre el formulario de nueva categoría', async () => {
    const user = userEvent.setup()
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    expect(screen.getByText(/nueva categoría/i, { selector: 'h2' })).toBeInTheDocument()
  })

  it('el botón Crear está deshabilitado con nombre vacío', async () => {
    const user = userEvent.setup()
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    const crearButton = screen.getByRole('button', { name: /crear/i })
    expect(crearButton).toBeDisabled()
  })

  it('el botón Crear se habilita al escribir un nombre', async () => {
    const user = userEvent.setup()
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    await user.type(screen.getByPlaceholderText(/mascotas/i), 'Deportes')
    expect(screen.getByRole('button', { name: /crear/i })).not.toBeDisabled()
  })

  it('llama a insert al guardar una categoría nueva', async () => {
    const { mockInsert } = makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    await user.type(screen.getByPlaceholderText(/mascotas/i), 'Deportes')
    await user.click(screen.getByRole('button', { name: /crear/i }))
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Deportes' }))
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('abre el formulario de edición al hacer clic en el lápiz', async () => {
    const user = userEvent.setup()
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={jest.fn()} />)
    const editButtons = screen.getAllByRole('button', { name: /editar|pencil/i })
    await user.click(editButtons[0])
    expect(screen.getByText(/editar categoría/i, { selector: 'h2' })).toBeInTheDocument()
  })

  it('llama a onRefresh después de eliminar una categoría', async () => {
    makeMock()
    const onRefresh = jest.fn()
    const user = userEvent.setup()
    render(<CategoryManager categories={categories} companyId="company-1" role="owner" onClose={jest.fn()} onRefresh={onRefresh} />)
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar|trash|delete/i })
    await user.click(deleteButtons[0])
    // Confirm dialog appears — click the "Eliminar" confirmation button (not the trash icon)
    const allDeleteBtns = await screen.findAllByRole('button', { name: /eliminar/i })
    // The last "Eliminar" button is the ConfirmDialog confirm button
    await user.click(allDeleteBtns[allDeleteBtns.length - 1])
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })
})
