import { test, expect } from '@playwright/test'

// Requiere: TEST_EMAIL y TEST_PASSWORD en el entorno, y la app corriendo en localhost:3000

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123'

test.describe('Navegación entre tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill(EMAIL)
    await page.getByLabel(/contraseña/i).fill(PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await expect(page).toHaveURL(/\?tab=dashboard|^\/$/, { timeout: 10_000 })
  })

  test('navega al tab Clientes', async ({ page }) => {
    await page.getByRole('button', { name: /clientes/i }).click()
    await expect(page).toHaveURL(/tab=clients/)
  })

  test('navega al tab Pedidos', async ({ page }) => {
    await page.getByRole('button', { name: /pedidos/i }).click()
    await expect(page).toHaveURL(/tab=orders/)
  })

  test('navega al tab Gastos', async ({ page }) => {
    await page.getByRole('button', { name: /gastos/i }).click()
    await expect(page).toHaveURL(/tab=expenses/)
  })

  test('navega al tab Finanzas', async ({ page }) => {
    await page.getByRole('button', { name: /finanzas/i }).click()
    await expect(page).toHaveURL(/tab=finance/)
  })

  test('navega de vuelta al Resumen', async ({ page }) => {
    await page.getByRole('button', { name: /gastos/i }).click()
    await page.getByRole('button', { name: /resumen/i }).click()
    await expect(page).toHaveURL(/tab=dashboard/)
  })

  test('los 5 tabs cargan sin errores de consola', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const tabs = [
      { button: /clientes/i },
      { button: /pedidos/i },
      { button: /gastos/i },
      { button: /finanzas/i },
      { button: /resumen/i },
    ]
    for (const { button } of tabs) {
      await page.getByRole('button', { name: button }).click()
      await page.waitForTimeout(500)
    }
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})
