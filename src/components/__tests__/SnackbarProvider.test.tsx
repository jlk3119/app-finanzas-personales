import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SnackbarProvider, useSnackbar } from '../SnackbarProvider'

function Demo() {
  const snackbar = useSnackbar()
  return (
    <div>
      <button onClick={() => snackbar('Gasto registrado', 'success')}>éxito</button>
      <button onClick={() => snackbar('No se pudo guardar', 'error')}>fallo</button>
    </div>
  )
}

const renderDemo = () =>
  render(
    <SnackbarProvider>
      <Demo />
    </SnackbarProvider>,
  )

describe('SnackbarProvider', () => {
  it('muestra el mensaje de éxito al invocar el snackbar', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'éxito' }))
    expect(screen.getByRole('status')).toHaveTextContent('Gasto registrado')
  })

  it('muestra el mensaje de error con aria-live assertive', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'fallo' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No se pudo guardar')
    expect(status).toHaveAttribute('aria-live', 'assertive')
  })

  it('reemplaza el mensaje anterior al mostrar uno nuevo', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'éxito' }))
    await user.click(screen.getByRole('button', { name: 'fallo' }))
    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar')).toBeInTheDocument()
      expect(screen.queryByText('Gasto registrado')).not.toBeInTheDocument()
    })
  })

  it('se descarta al tocarlo', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'éxito' }))
    await user.click(screen.getByRole('status'))
    await waitFor(() => expect(screen.queryByText('Gasto registrado')).not.toBeInTheDocument())
  })

  it('se auto-descarta después del tiempo de espera', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderDemo()
      await user.click(screen.getByRole('button', { name: 'éxito' }))
      expect(screen.getByText('Gasto registrado')).toBeInTheDocument()
      act(() => {
        jest.advanceTimersByTime(4500)
      })
      await waitFor(() => expect(screen.queryByText('Gasto registrado')).not.toBeInTheDocument())
    } finally {
      jest.useRealTimers()
    }
  })
})
