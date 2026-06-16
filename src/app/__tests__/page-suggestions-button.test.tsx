/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../page'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const now = new Date()
const curM = now.getMonth() + 1
const curY = now.getFullYear()

function setupSupabase() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    order: () => builder,
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    then: (res: any, rej: any) => Promise.resolve({ data: [], error: null }).then(res, rej),
  }
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }), signOut: jest.fn() },
    from: () => builder,
  } as any)
}

beforeEach(() => {
  window.localStorage.clear()
  setupSupabase()
})
afterEach(() => jest.clearAllMocks())

describe('Botón Sugerencias', () => {
  it('abre la sección de sugerencias sin desmontar Configuración (evita colisión del historial)', async () => {
    const { container } = render(<Dashboard />)
    await within(container).findByText(new RegExp(`${MONTHS[curM - 1]} ${curY}`))
    const user = userEvent.setup()
    // Abrir Configuración (header o sidebar; cualquiera sirve)
    await user.click(within(container).getAllByRole('button', { name: /configuración/i })[0])
    // Los Sheets se renderizan en un portal → consultar con screen
    await screen.findByText('Apariencia')
    await user.click(screen.getByRole('button', { name: /sugerencias/i }))
    // La sección de sugerencias se abre (su textarea es exclusiva)…
    expect(await screen.findByRole('textbox', { name: /tu sugerencia/i })).toBeInTheDocument()
    // …y Configuración sigue montada. Con el bug (setShowSettings(false)) se desmontaría
    // y history.back() cerraría Sugerencias al instante.
    expect(screen.getByText('Apariencia')).toBeInTheDocument()
  })
})
