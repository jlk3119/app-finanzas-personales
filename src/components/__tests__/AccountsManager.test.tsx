/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountsManager from '../AccountsManager'
import { createClient } from '@/utils/supabase/client'
import type { Account, Expense, Income, RecurringIncome } from '@/types'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const now = new Date()
const cy = now.getFullYear()
const cm = now.getMonth() + 1
const pad = (n: number) => String(n).padStart(2, '0')
const thisMonth = (day = 10) => `${cy}-${pad(cm)}-${pad(day)}`
const lastMonth = cm === 1 ? `${cy - 1}-12-10` : `${cy}-${pad(cm - 1)}-10`

const makeAccount = (id: string, name: string, balance: number): Account => ({
  id, user_id: 'u1', name, balance, icon: '🏦', color: '#6366f1', created_at: '',
})

const makeExpense = (amount: number, date: string): Expense => ({
  id: `e-${Math.random()}`, user_id: 'u1', category_id: null,
  amount, description: null, date, created_at: '',
})

const acc1 = makeAccount('acc-1', 'Lulobank', 500_000)
const acc2 = makeAccount('acc-2', 'Bancolombia', 300_000)

const defaultProps = {
  accounts: [acc1],
  expenses: [] as Expense[],
  income: [] as Income[],
  recurringIncome: [] as RecurringIncome[],
  onRefresh: jest.fn(),
}

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

describe('AccountsManager — disponible dinámico', () => {
  it('muestra el disponible igual al saldo cuando no hay gastos', () => {
    render(<AccountsManager {...defaultProps} />)
    // banner y tarjeta deben mostrar 500 000
    expect(screen.getAllByText(/500\.?000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/disponible total/i)).toBeInTheDocument()
  })

  it('descuenta los gastos del mes actual del disponible total', () => {
    const expenses = [makeExpense(100_000, thisMonth(5)), makeExpense(50_000, thisMonth(8))]
    render(<AccountsManager {...defaultProps} expenses={expenses} />)
    // disponible = 500 000 − 150 000 = 350 000
    expect(screen.getAllByText(/350\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('no descuenta gastos de meses anteriores', () => {
    const expenses = [makeExpense(200_000, lastMonth)]
    render(<AccountsManager {...defaultProps} expenses={expenses} />)
    // disponible sigue siendo 500 000
    expect(screen.getAllByText(/500\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('el saldo bruto de la cuenta aparece como referencia', () => {
    const expenses = [makeExpense(100_000, thisMonth())]
    render(<AccountsManager {...defaultProps} expenses={expenses} />)
    // el saldo bruto 500 000 debe aparecer en algún lugar (referencia pequeña)
    expect(screen.getAllByText(/500\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('con múltiples cuentas el disponible es la suma total menos los gastos', () => {
    const expenses = [makeExpense(200_000, thisMonth())]
    render(<AccountsManager {...defaultProps} accounts={[acc1, acc2]} expenses={expenses} />)
    // 500 000 + 300 000 − 200 000 = 600 000
    expect(screen.getAllByText(/600\.?000/).length).toBeGreaterThanOrEqual(1)
  })

  it('muestra el nombre de cada cuenta', () => {
    render(<AccountsManager {...defaultProps} accounts={[acc1, acc2]} />)
    expect(screen.getByText('Lulobank')).toBeInTheDocument()
    expect(screen.getByText('Bancolombia')).toBeInTheDocument()
  })

  it('muestra el detalle saldo − gastos en el banner', () => {
    const expenses = [makeExpense(50_000, thisMonth())]
    render(<AccountsManager {...defaultProps} expenses={expenses} />)
    // el banner tiene el subtítulo con los montos
    expect(screen.getByText(/gastos del mes/i)).toBeInTheDocument()
  })
})

describe('AccountsManager — gestión de cuentas', () => {
  it('muestra empty state cuando no hay cuentas', () => {
    render(<AccountsManager {...defaultProps} accounts={[]} />)
    expect(screen.getByText(/agrega tu primera cuenta/i)).toBeInTheDocument()
  })

  it('abre el formulario de nueva cuenta al hacer clic en Nueva', async () => {
    const user = userEvent.setup()
    render(<AccountsManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /nueva/i }))
    expect(screen.getByText(/crear cuenta/i)).toBeInTheDocument()
  })

  it('cancela el formulario de cuenta y vuelve a la vista principal', async () => {
    const user = userEvent.setup()
    render(<AccountsManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /nueva/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.getByText(/disponible total/i)).toBeInTheDocument()
  })

  it('abre el formulario de edición con datos precargados', async () => {
    const user = userEvent.setup()
    render(<AccountsManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /editar|pencil/i }))
    expect(screen.getByText(/actualizar/i)).toBeInTheDocument()
    expect((screen.getByDisplayValue('Lulobank') as HTMLInputElement).value).toBe('Lulobank')
  })

  it('guarda una cuenta nueva llamando a insert', async () => {
    const { mockInsert } = makeMock()
    const user = userEvent.setup()
    render(<AccountsManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /nueva/i }))
    await user.type(screen.getByPlaceholderText(/bancolombia/i), 'Nequi')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
  })
})

describe('AccountsManager — ingresos recurrentes', () => {
  it('muestra la sección de ingresos recurrentes', () => {
    render(<AccountsManager {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /ingresos recurrentes/i })).toBeInTheDocument()
  })

  it('abre el formulario de ingreso recurrente', async () => {
    const user = userEvent.setup()
    render(<AccountsManager {...defaultProps} />)
    // Two buttons match /agregar/i: the header button and the empty-state button — take the first
    await user.click(screen.getAllByRole('button', { name: /agregar/i })[0])
    expect(screen.getByRole('heading', { name: /nuevo ingreso recurrente/i })).toBeInTheDocument()
  })
})
