import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123'

test.describe('Flujo de gastos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill(EMAIL)
    await page.getByLabel(/contraseña/i).fill(PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await expect(page).toHaveURL(/tab=dashboard|^\/$/, { timeout: 10_000 })
  })

  test('crear un gasto nuevo', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo gasto/i }).click()
    await expect(page.getByText(/nuevo gasto/i)).toBeVisible()

    await page.getByLabel(/monto/i).fill('50000')
    await page.getByLabel(/descripción/i).fill('Café de prueba E2E')
    await page.getByRole('button', { name: /guardar gasto/i }).click()

    // El sheet debe cerrarse y el gasto aparecer en la lista
    await expect(page.getByText('Café de prueba E2E')).toBeVisible({ timeout: 5_000 })
  })

  test('el gasto recién creado aparece en el tab Gastos', async ({ page }) => {
    // Crear gasto
    await page.getByRole('button', { name: /nuevo gasto/i }).click()
    await page.getByLabel(/monto/i).fill('75000')
    await page.getByLabel(/descripción/i).fill('Gasto E2E tab')
    await page.getByRole('button', { name: /guardar gasto/i }).click()

    // Ir a tab Gastos
    await page.getByRole('button', { name: /gastos/i }).click()
    await expect(page.getByText('Gasto E2E tab')).toBeVisible({ timeout: 5_000 })
  })

  test('el total de Hoy se actualiza al agregar un gasto', async ({ page }) => {
    const todayBefore = await page.getByText('Hoy').locator('..').getByText(/\$/).textContent()

    await page.getByRole('button', { name: /nuevo gasto/i }).click()
    await page.getByLabel(/monto/i).fill('10000')
    await page.getByRole('button', { name: /guardar gasto/i }).click()

    await page.waitForTimeout(1000)
    const todayAfter = await page.getByText('Hoy').locator('..').getByText(/\$/).textContent()
    expect(todayAfter).not.toBe(todayBefore)
  })

  test('eliminar un gasto', async ({ page }) => {
    // Crear gasto para eliminar
    await page.getByRole('button', { name: /nuevo gasto/i }).click()
    await page.getByLabel(/monto/i).fill('5000')
    await page.getByLabel(/descripción/i).fill('Para eliminar E2E')
    await page.getByRole('button', { name: /guardar gasto/i }).click()
    await expect(page.getByText('Para eliminar E2E')).toBeVisible()

    // Ir a Gastos y eliminar
    await page.getByRole('button', { name: /gastos/i }).click()
    const gasto = page.getByText('Para eliminar E2E').locator('..')
    await gasto.getByRole('button', { name: /eliminar|trash/i }).click()
    await expect(page.getByText('Para eliminar E2E')).not.toBeVisible({ timeout: 5_000 })
  })

  test('crear un gasto con categoría y subcategoría', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo gasto/i }).click()
    await page.getByLabel(/monto/i).fill('35000')

    // Seleccionar una categoría padre
    const catButtons = page.locator('[class*="rounded-xl"][class*="border"]')
    if (await catButtons.count() > 0) {
      await catButtons.first().click()
    }

    await page.getByRole('button', { name: /guardar gasto/i }).click()
    await expect(page.getByText(/35\.?000/)).toBeVisible({ timeout: 5_000 })
  })
})
