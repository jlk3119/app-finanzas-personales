import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123'

test.describe('Flujo de presupuesto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill(EMAIL)
    await page.getByLabel(/contraseña/i).fill(PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await page.getByRole('button', { name: /presup/i }).click()
    await expect(page).toHaveURL(/tab=budget/, { timeout: 10_000 })
  })

  test('crear un presupuesto mensual global', async ({ page }) => {
    await page.getByRole('button', { name: /agregar presupuesto/i }).click()
    await expect(page.getByText(/nuevo presupuesto/i)).toBeVisible()

    const amountInput = page.getByPlaceholder('0')
    await amountInput.fill('2000000')
    await page.getByRole('button', { name: /guardar/i }).click()

    await expect(page.getByText(/2\.?000\.?000/)).toBeVisible({ timeout: 5_000 })
  })

  test('el presupuesto se refleja en el Resumen', async ({ page }) => {
    // Crear presupuesto si no existe
    await page.getByRole('button', { name: /agregar presupuesto/i }).click()
    const amountInput = page.getByPlaceholder('0')
    await amountInput.fill('1500000')
    await page.getByRole('button', { name: /guardar/i }).click()

    // Ir al Resumen
    await page.getByRole('button', { name: /resumen/i }).click()
    await expect(page.getByText(/mes/i)).toBeVisible()
  })

  test('editar un presupuesto existente', async ({ page }) => {
    // Crear uno primero
    await page.getByRole('button', { name: /agregar presupuesto/i }).click()
    await page.getByPlaceholder('0').fill('500000')
    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(/500\.?000/)).toBeVisible()

    // Editar
    await page.getByRole('button', { name: /editar|pencil/i }).first().click()
    await expect(page.getByText(/editar presupuesto/i)).toBeVisible()
    await page.getByPlaceholder('0').clear()
    await page.getByPlaceholder('0').fill('600000')
    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(/600\.?000/)).toBeVisible({ timeout: 5_000 })
  })

  test('agregar presupuesto con subcategorías', async ({ page }) => {
    await page.getByRole('button', { name: /agregar presupuesto/i }).click()

    // Seleccionar una categoría padre (si existe en el select)
    const select = page.locator('[data-testid="select"], select').first()
    const options = await select.locator('option').all()
    const parentOption = options.find(async (o) => !(await o.getAttribute('value'))?.startsWith('global'))

    if (parentOption) {
      const value = await parentOption.getAttribute('value')
      if (value) {
        await select.selectOption(value)
        // Verificar que aparece sección de subcategorías
        const subSection = page.getByText(/subcategorías/i)
        if (await subSection.isVisible()) {
          const inputs = page.getByPlaceholder('0')
          await inputs.first().fill('300000')
          await page.getByRole('button', { name: /guardar/i }).click()
          await expect(page.getByText(/300\.?000/)).toBeVisible({ timeout: 5_000 })
        }
      }
    }
  })

  test('eliminar un presupuesto', async ({ page }) => {
    // Crear
    await page.getByRole('button', { name: /agregar presupuesto/i }).click()
    await page.getByPlaceholder('0').fill('50000')
    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(/50\.?000/)).toBeVisible()

    // Eliminar
    await page.getByRole('button', { name: /eliminar|trash/i }).first().click()
    await expect(page.getByText(/50\.?000/)).not.toBeVisible({ timeout: 5_000 })
  })
})
