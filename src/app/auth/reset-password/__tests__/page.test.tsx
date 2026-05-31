/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordPage from '../page'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock de onAuthStateChange que permite disparar el evento manualmente
function makeMock({ user = null as any, updateError = null as any } = {}) {
  let authCb: ((event: string) => void) | null = null
  const onAuthStateChange = jest.fn().mockImplementation((cb: (event: string) => void) => {
    authCb = cb
    return { data: { subscription: { unsubscribe: jest.fn() } } }
  })
  const getUser = jest.fn().mockResolvedValue({ data: { user } })
  const updateUser = jest.fn().mockResolvedValue({ data: {}, error: updateError })
  mockCreateClient.mockReturnValue({
    auth: { onAuthStateChange, getUser, updateUser },
  } as any)
  return { onAuthStateChange, getUser, updateUser, fireRecovery: () => act(() => { authCb?.('PASSWORD_RECOVERY') }) }
}

afterEach(() => jest.clearAllMocks())

describe('ResetPasswordPage', () => {
  it('muestra "Verificando enlace…" mientras no hay sesión ni evento de recuperación', () => {
    makeMock()
    render(<ResetPasswordPage />)
    expect(screen.getByText(/verificando enlace/i)).toBeInTheDocument()
  })

  it('muestra el formulario tras el evento PASSWORD_RECOVERY', async () => {
    const { fireRecovery } = makeMock()
    render(<ResetPasswordPage />)
    await fireRecovery()
    expect(await screen.findByLabelText(/nueva contraseña/i)).toBeInTheDocument()
  })

  it('muestra el formulario si ya hay sesión activa (redirect desde callback)', async () => {
    makeMock({ user: { id: 'u1' } })
    render(<ResetPasswordPage />)
    expect(await screen.findByLabelText(/nueva contraseña/i)).toBeInTheDocument()
  })

  it('valida longitud mínima de la contraseña', async () => {
    const { updateUser, fireRecovery } = makeMock()
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await fireRecovery()
    await user.type(await screen.findByLabelText(/nueva contraseña/i), '123')
    await user.type(screen.getByLabelText(/confirmar contraseña/i), '123')
    await user.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))
    expect(await screen.findByText(/al menos 6 caracteres/i)).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('valida que las contraseñas coincidan', async () => {
    const { updateUser, fireRecovery } = makeMock()
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await fireRecovery()
    await user.type(await screen.findByLabelText(/nueva contraseña/i), 'secreta123')
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'otra12345')
    await user.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))
    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('actualiza la contraseña y muestra el éxito', async () => {
    const { updateUser, fireRecovery } = makeMock()
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await fireRecovery()
    await user.type(await screen.findByLabelText(/nueva contraseña/i), 'secreta123')
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'secreta123')
    await user.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'secreta123' }))
    expect(await screen.findByText(/contraseña actualizada/i)).toBeInTheDocument()
  })

  it('muestra error si Supabase falla al actualizar', async () => {
    const { fireRecovery } = makeMock({ updateError: { message: 'session expired' } })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await fireRecovery()
    await user.type(await screen.findByLabelText(/nueva contraseña/i), 'secreta123')
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'secreta123')
    await user.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))
    expect(await screen.findByText(/no se pudo actualizar la contraseña/i)).toBeInTheDocument()
  })
})
