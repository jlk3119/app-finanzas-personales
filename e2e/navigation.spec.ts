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

  test('navega al tab Gastos', async ({ page }) => {
    await page.getByRole('button', { name: /gastos/i }).click()
    await expect(page).toHaveURL(/tab=expenses/)
  })

  test('navega al tab Presupuesto', async ({ page }) => {
    await page.getByRole('button', { name: /presup/i }).click()
    await expect(page).toHaveURL(/tab=budget/)
  })

  test('navega al tab Metas', async ({ page }) => {
    await page.getByRole('button', { name: /metas/i }).click()
    await expect(page).toHaveURL(/tab=goals/)
  })

  test('navega al tab Dinero', async ({ page }) => {
    await page.getByRole('button', { name: /dinero/i }).click()
    await expect(page).toHaveURL(/tab=accounts/)
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
    const tabs = ['expenses', 'budget', 'goals', 'accounts', 'dashboard']
    for (const tab of tabs) {
      await page.getByRole('button', { name: new RegExp(tab === 'dashboard' ? 'resumen' : tab === 'budget' ? 'presup' : tab, 'i') }).click()
      await page.waitForTimeout(500)
    }
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})
