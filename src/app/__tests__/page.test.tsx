/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../page'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/components/FinancialSummaryCard', () => ({
  __esModule: true,
  default: () => null,
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const now = new Date()
const curM = now.getMonth() + 1
const curY = now.getFullYear()
const curKey = `${curY}-${String(curM).padStart(2, '0')}`
const nextM = curM === 12 ? 1 : curM + 1
const nextY = curM === 12 ? curY + 1 : curY
const prevM = curM === 1 ? 12 : curM - 1
const prevY = curM === 1 ? curY - 1 : curY

const sysCat = { id: 'sys', user_id: 'u1', name: 'Caja menor', icon: '💵', color: '#10b981', is_system: true, parent_id: null, created_at: '' }

type Tables = Record<string, any[]>

function setupSupabase(tables: Tables) {
  const upsert = jest.fn().mockResolvedValue({ data: null, error: null })
  const makeBuilder = (data: any[]) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      order: () => builder,
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      upsert,
      then: (res: any, rej: any) => Promise.resolve({ data, error: null }).then(res, rej),
    }
    return builder
  }
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }), signOut: jest.fn() },
    from: (table: string) => makeBuilder(tables[table] ?? []),
  } as any)
  return { upsert }
}

const baseTables = (closures: any[], expenses: any[]): Tables => ({
  expenses,
  budgets: [],
  categories: [sysCat],
  goals: [],
  accounts: [],
  income: [],
  recurring_income: [],
  month_closures: closures,
  debts: [],
})

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => jest.clearAllMocks())

describe('Dashboard — Resumen por mes de presupuesto', () => {
  it('por defecto muestra el mes calendario actual cuando no hay cierres', async () => {
    setupSupabase(baseTables([], []))
    render(<Dashboard />)
    const label = await screen.findByText(new RegExp(`${MONTHS[curM - 1]} ${curY}`))
    expect(label).toBeInTheDocument()
  })

  it('por defecto salta el mes cerrado y muestra el siguiente', async () => {
    setupSupabase(baseTables([{ id: 'c', user_id: 'u1', year: curY, month: curM, closed_at: '' }], []))
    render(<Dashboard />)
    const label = await screen.findByText(new RegExp(`${MONTHS[nextM - 1]} ${nextY} · presupuesto`))
    expect(label).toBeInTheDocument()
  })

  it('permite navegar a meses anteriores con la flecha', async () => {
    setupSupabase(baseTables([], []))
    render(<Dashboard />)
    const label = await screen.findByText(new RegExp(`${MONTHS[curM - 1]} ${curY}`))
    const nav = label.parentElement as HTMLElement
    const user = userEvent.setup()
    const [prevBtn] = within(nav).getAllByRole('button')
    await user.click(prevBtn)
    expect(await screen.findByText(new RegExp(`${MONTHS[prevM - 1]} ${prevY} · presupuesto`))).toBeInTheDocument()
  })

  it('ofrece "Cerrar mes" en el mes vivo con datos y avanza al cerrar', async () => {
    const expenses = [
      { id: 'e1', user_id: 'u1', category_id: 'sys', amount: 50_000, description: 'x', date: `${curKey}-10`, budget_period: curKey, created_at: '', categories: sysCat },
    ]
    setupSupabase(baseTables([], expenses))
    render(<Dashboard />)
    const user = userEvent.setup()
    const closeBtn = await screen.findByRole('button', { name: new RegExp(`Cerrar mes de ${MONTHS[curM - 1]}`, 'i') })
    await user.click(closeBtn)
    const entendido = await screen.findByRole('button', { name: /entendido/i })
    await user.click(entendido)
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`${MONTHS[nextM - 1]} ${nextY} · presupuesto`))).toBeInTheDocument()
    })
  })

  it('no muestra la tarjeta de cierre automáticamente en un mes no cerrado', async () => {
    // Mayo cerrado → el Resumen abre en junio (no vivo). Junio NO está cerrado,
    // así que NO debe aparecer la tarjeta "Resumen del mes cerrado" sin pulsar el botón.
    const expenses = [
      { id: 'e1', user_id: 'u1', category_id: 'sys', amount: 50_000, description: 'x', date: `${nextY}-${String(nextM).padStart(2, '0')}-10`, budget_period: `${nextY}-${String(nextM).padStart(2, '0')}`, created_at: '', categories: sysCat },
    ]
    setupSupabase(baseTables([{ id: 'c', user_id: 'u1', year: curY, month: curM, closed_at: '' }], expenses))
    render(<Dashboard />)
    await screen.findByText(new RegExp(`${MONTHS[nextM - 1]} ${nextY} · presupuesto`))
    expect(screen.queryByText(/resumen del mes cerrado/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: new RegExp(`Cerrar mes de ${MONTHS[nextM - 1]}`, 'i') })).toBeInTheDocument()
  })

  it('el total "Mes" refleja solo gastos del budget_period seleccionado', async () => {
    const expenses = [
      { id: 'e1', user_id: 'u1', category_id: 'sys', amount: 70_000, description: 'mes actual', date: `${curKey}-05`, budget_period: curKey, created_at: '', categories: sysCat },
      { id: 'e2', user_id: 'u1', category_id: 'sys', amount: 999_000, description: 'otro mes', date: `${nextY}-${String(nextM).padStart(2, '0')}-05`, budget_period: `${nextY}-${String(nextM).padStart(2, '0')}`, created_at: '', categories: sysCat },
    ]
    setupSupabase(baseTables([], expenses))
    render(<Dashboard />)
    await screen.findByText(new RegExp(`${MONTHS[curM - 1]} ${curY}`))
    expect(screen.queryByText(/999\.?000/)).not.toBeInTheDocument()
  })
})
