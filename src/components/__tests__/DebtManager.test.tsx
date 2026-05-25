/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DebtManager from '../DebtManager'
import { createClient } from '@/utils/supabase/client'
import type { Debt } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const makeDebt = (id: string, name: string, entity: string, total: number, paid: number): Debt => ({
  id, company_id: 'company-1', name, entity,
  total_amount: total, paid_amount: paid,
  icon: '💳', notes: null, created_at: '',
})

const debt1 = makeDebt('d-1', 'Crédito vivienda', 'Bancolombia', 50_000_000, 10_000_000)
const debt2 = makeDebt('d-2', 'Tarjeta de crédito', 'Davivienda', 2_000_000, 2_000_000)

function makeMock() {
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const chainable: any = {}
  ;['eq', 'is', 'in', 'neq', 'order', 'select', 'single'].forEach(
    (m) => { chainable[m] = jest.fn().mockReturnValue(chainable) },
  )
  Object.assign(chainable, { then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve) })
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: jest.fn().mockReturnValue({
      insert: mockInsert,
      update: jest.fn().mockReturnValue(chainable),
      delete: jest.fn().mockReturnValue(chainable),
      select: jest.fn().mockReturnValue(chainable),
    }),
  } as any)
  return { mockInsert }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('DebtManager — lista', () => {
  it('muestra empty state cuando no hay deudas', () => {
    render(<DebtManager debts={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/sin deudas registradas/i)).toBeInTheDocument()
  })

  it('muestra el nombre y entidad de cada deuda', () => {
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText('Crédito vivienda')).toBeInTheDocument()
    expect(screen.getByText('Bancolombia')).toBeInTheDocument()
  })

  it('muestra el resumen con total, pagado y pendiente cuando hay deudas', () => {
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByText(/total deuda/i)).toBeInTheDocument()
    expect(screen.getAllByText(/pagado/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument()
  })

  it('marca la deuda como saldada cuando paid_amount >= total_amount', () => {
    render(<DebtManager debts={[debt2]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getAllByText(/saldada/i).length).toBeGreaterThanOrEqual(1)
  })

  it('no muestra botón "Registrar pago" para deudas saldadas', () => {
    render(<DebtManager debts={[debt2]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /registrar pago/i })).not.toBeInTheDocument()
  })

  it('muestra botón "Registrar pago" para deudas pendientes', () => {
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    expect(screen.getByRole('button', { name: /registrar pago/i })).toBeInTheDocument()
  })
})

describe('DebtManager — formulario nueva deuda', () => {
  it('abre el formulario al hacer clic en Nueva deuda', async () => {
    const user = userEvent.setup()
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nueva deuda/i }))
    expect(screen.getByText(/nueva deuda/i)).toBeInTheDocument()
  })

  it('abre el formulario desde el empty state', async () => {
    const user = userEvent.setup()
    render(<DebtManager debts={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /registrar primera deuda/i }))
    expect(screen.getByText(/nueva deuda/i)).toBeInTheDocument()
  })

  it('cancela el formulario y vuelve a la lista', async () => {
    const user = userEvent.setup()
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /nueva deuda/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.getByText('Crédito vivienda')).toBeInTheDocument()
  })

  it('llama a insert al crear una deuda nueva', async () => {
    const { mockInsert } = makeMock()
    const user = userEvent.setup()
    render(<DebtManager debts={[]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /registrar primera deuda/i }))
    await user.type(screen.getByPlaceholderText(/crédito vivienda/i), 'Préstamo personal')
    await user.type(screen.getByPlaceholderText(/bancolombia/i), 'Nequi')
    await user.type(screen.getAllByPlaceholderText('0')[0], '1000000')
    await user.click(screen.getByRole('button', { name: /crear deuda/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
  })
})

describe('DebtManager — edición', () => {
  it('abre el formulario de edición con datos precargados', async () => {
    const user = userEvent.setup()
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /editar/i }))
    expect(screen.getByText(/editar deuda/i)).toBeInTheDocument()
    expect((screen.getByDisplayValue('Crédito vivienda') as HTMLInputElement).value).toBe('Crédito vivienda')
    expect((screen.getByDisplayValue('Bancolombia') as HTMLInputElement).value).toBe('Bancolombia')
  })
})

describe('DebtManager — registrar pago', () => {
  it('abre el formulario de pago al hacer clic en Registrar pago', async () => {
    const user = userEvent.setup()
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /registrar pago/i }))
    expect(screen.getByText(/monto del pago/i)).toBeInTheDocument()
  })

  it('llama a update al registrar un pago', async () => {
    const chainable: any = {}
    ;['eq', 'is', 'in', 'neq', 'order', 'select', 'single'].forEach(
      (m) => { chainable[m] = jest.fn().mockReturnValue(chainable) },
    )
    Object.assign(chainable, { then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve) })
    const mockUpdate = jest.fn().mockReturnValue(chainable)
    mockCreateClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: mockUpdate,
        delete: jest.fn().mockReturnValue(chainable),
        select: jest.fn().mockReturnValue(chainable),
      }),
    } as any)
    const user = userEvent.setup()
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /registrar pago/i }))
    await user.type(screen.getByPlaceholderText('0'), '500000')
    await user.click(screen.getByRole('button', { name: /registrar pago/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
  })

  it('cancela el pago y vuelve a la lista', async () => {
    const user = userEvent.setup()
    render(<DebtManager debts={[debt1]} companyId="company-1" role="owner" onRefresh={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /registrar pago/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.getByText('Crédito vivienda')).toBeInTheDocument()
  })
})
