/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, waitFor } from '@testing-library/react'
import { useCompany } from '../useCompany'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const mockCompany = { id: 'company-1', name: 'Mi Negocio S.A.S', nit: null, join_code: 'ABC12345', created_at: '' }

function makeMock(companyData: object | null) {
  const mockMaybeSingle = jest.fn().mockResolvedValue({
    data: companyData,
    error: null,
  })
  const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
  const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit })
  mockCreateClient.mockReturnValue({
    from: jest.fn().mockReturnValue({ select: mockSelect }),
  } as any)
  return { mockMaybeSingle }
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

describe('useCompany', () => {
  it('retorna companyId y role cuando el usuario tiene membresía', async () => {
    makeMock({ role: 'owner', companies: mockCompany })
    const { result } = renderHook(() => useCompany())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.companyId).toBe('company-1')
    expect(result.current.role).toBe('owner')
    expect(result.current.company?.name).toBe('Mi Negocio S.A.S')
  })

  it('retorna null cuando el usuario no tiene membresía', async () => {
    makeMock(null)
    const { result } = renderHook(() => useCompany())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.companyId).toBeNull()
    expect(result.current.role).toBeNull()
    expect(result.current.company).toBeNull()
  })

  it('retorna role employee correctamente', async () => {
    makeMock({ role: 'employee', companies: mockCompany })
    const { result } = renderHook(() => useCompany())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('employee')
  })

  it('precarga companyId desde localStorage sin esperar el fetch', async () => {
    localStorage.setItem('minegocio_company', JSON.stringify({ companyId: 'company-1', role: 'owner' }))
    makeMock({ role: 'owner', companies: mockCompany })
    const { result } = renderHook(() => useCompany())
    // companyId and role are immediately available from cache before async fetch
    expect(result.current.companyId).toBe('company-1')
    expect(result.current.role).toBe('owner')
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('guarda el resultado en localStorage después de fetch', async () => {
    makeMock({ role: 'owner', companies: mockCompany })
    const { result } = renderHook(() => useCompany())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const cached = JSON.parse(localStorage.getItem('minegocio_company') ?? 'null')
    expect(cached).toEqual({ companyId: 'company-1', role: 'owner' })
  })

  it('limpia localStorage cuando no hay membresía', async () => {
    localStorage.setItem('minegocio_company', JSON.stringify({ companyId: 'stale-id', role: 'owner' }))
    makeMock(null)
    const { result } = renderHook(() => useCompany())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(localStorage.getItem('minegocio_company')).toBeNull()
  })

  it('expone función refresh que vuelve a consultar la BD', async () => {
    makeMock({ role: 'owner', companies: mockCompany })
    const { result } = renderHook(() => useCompany())
    await waitFor(() => expect(result.current.loading).toBe(false))
    result.current.refresh()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.companyId).toBe('company-1')
  })
})
