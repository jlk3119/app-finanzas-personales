/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../page'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

function makeMock() {
  const resetPasswordForEmail = jest.fn().mockResolvedValue({ data: {}, error: null })
  const signInWithPassword = jest.fn().mockResolvedValue({ data: {}, error: null })
  const signUp = jest.fn().mockResolvedValue({ data: {}, error: null })
  mockCreateClient.mockReturnValue({
    auth: { resetPasswordForEmail, signInWithPassword, signUp },
  } as any)
  return { resetPasswordForEmail, signInWithPassword, signUp }
}

beforeEach(() => makeMock())
afterEach(() => jest.clearAllMocks())

describe('LoginPage — recuperación de contraseña', () => {
  it('abre el formulario de recuperación desde "¿Olvidaste tu contraseña?"', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    expect(screen.getByRole('heading', { name: /recuperar contraseña/i })).toBeInTheDocument()
  })

  it('envía el correo de recuperación con redirectTo a /auth/reset-password', async () => {
    const { resetPasswordForEmail } = makeMock()
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await user.type(screen.getByLabelText(/correo/i), 'ketty@correo.com')
    await user.click(screen.getByRole('button', { name: /enviar instrucciones/i }))
    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        'ketty@correo.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/auth/reset-password') }),
      )
    })
  })

  it('muestra confirmación neutra sin revelar si el correo existe', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await user.type(screen.getByLabelText(/correo/i), 'ketty@correo.com')
    await user.click(screen.getByRole('button', { name: /enviar instrucciones/i }))
    expect(await screen.findByText(/si existe una cuenta con/i)).toBeInTheDocument()
    expect(screen.getByText(/ketty@correo\.com/)).toBeInTheDocument()
  })

  it('muestra confirmación aunque Supabase devuelva error (no filtra existencia)', async () => {
    const resetPasswordForEmail = jest.fn().mockResolvedValue({ data: null, error: { message: 'User not found' } })
    mockCreateClient.mockReturnValue({ auth: { resetPasswordForEmail } } as any)
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await user.type(screen.getByLabelText(/correo/i), 'noexiste@correo.com')
    await user.click(screen.getByRole('button', { name: /enviar instrucciones/i }))
    expect(await screen.findByText(/si existe una cuenta con/i)).toBeInTheDocument()
  })

  it('permite volver al inicio de sesión desde la confirmación', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await user.type(screen.getByLabelText(/correo/i), 'ketty@correo.com')
    await user.click(screen.getByRole('button', { name: /enviar instrucciones/i }))
    await user.click(await screen.findByRole('button', { name: /volver al inicio de sesión/i }))
    expect(screen.getByText(/inicia sesión en tu cuenta/i)).toBeInTheDocument()
  })
})
