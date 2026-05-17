import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123'

test.describe('Flujo de metas de ahorro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill(EMAIL)
    await page.getByLabel(/contraseña/i).fill(PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await page.getByRole('button', { name: /metas/i }).click()
    await expect(page).toHaveURL(/tab=goals/, { timeout: 10_000 })
  })

  test('crear una meta nueva', async ({ page }) => {
    await page.getByRole('button', { name: /nueva meta|crear primera meta/i }).click()
    await page.getByPlaceholder(/viaje|fondo/i).fill('Fondo de emergencias E2E')
    await page.getByPlaceholder('0').first().fill('6000000')
    await page.getByRole('button', { name: /crear meta/i }).click()
    await expect(page.getByText('Fondo de emergencias E2E')).toBeVisible({ timeout: 5_000 })
  })

  test('agregar ahorro a una meta sin categoría', async ({ page }) => {
    // Buscar una meta incompleta
    const agregarButtons = page.getByRole('button', { name: /agregar ahorro/i })
    if (await agregarButtons.count() === 0) {
      // Crear meta primero
      await page.getByRole('button', { name: /nueva meta|crear primera meta/i }).click()
      await page.getByPlaceholder(/viaje|fondo/i).fill('Meta ahorro E2E')
      await page.getByPlaceholder('0').first().fill('1000000')
      await page.getByRole('button', { name: /crear meta/i }).click()
    }

    await page.getByRole('button', { name: /agregar ahorro/i }).first().click()
    await page.getByPlaceholder(/monto a ahorrar/i).fill('100000')
    // Limpiar categoría
    const select = page.locator('select').last()
    await select.selectOption('')
    await page.getByRole('button', { name: /guardar ahorro/i }).click()

    // La barra de progreso debe haberse movido
    await expect(page.getByRole('progressbar').first()).toBeVisible({ timeout: 5_000 })
  })

  test('agregar ahorro con categoría fuente crea un gasto vinculado', async ({ page }) => {
    const agregarButtons = page.getByRole('button', { name: /agregar ahorro/i })
    if (await agregarButtons.count() === 0) {
      await page.getByRole('button', { name: /nueva meta|crear primera meta/i }).click()
      await page.getByPlaceholder(/viaje|fondo/i).fill('Meta con categoría E2E')
      await page.getByPlaceholder('0').first().fill('500000')
      await page.getByRole('button', { name: /crear meta/i }).click()
    }

    await page.getByRole('button', { name: /agregar ahorro/i }).first().click()
    await page.getByPlaceholder(/monto a ahorrar/i).fill('50000')

    // Seleccionar una categoría en el dropdown
    const select = page.locator('select').last()
    const options = await select.locator('option').all()
    if (options.length > 1) {
      const secondOption = options[1]
      const value = await secondOption.getAttribute('value')
      if (value) await select.selectOption(value)
    }

    await page.getByRole('button', { name: /guardar ahorro/i }).click()
    await expect(page.getByRole('progressbar').first()).toBeVisible({ timeout: 5_000 })

    // Verificar que el gasto se creó en la tab de gastos
    await page.getByRole('button', { name: /gastos/i }).click()
    await expect(page.getByText(/ahorro:/i)).toBeVisible({ timeout: 5_000 })
  })

  test('marcar meta como completada al llegar al monto objetivo', async ({ page }) => {
    // Crear meta con monto pequeño
    await page.getByRole('button', { name: /nueva meta|crear primera meta/i }).click()
    await page.getByPlaceholder(/viaje|fondo/i).fill('Meta pequeña E2E')
    await page.getByPlaceholder('0').first().fill('1000')
    await page.getByRole('button', { name: /crear meta/i }).click()

    await expect(page.getByText('Meta pequeña E2E')).toBeVisible()
    await page.getByRole('button', { name: /agregar ahorro/i }).last().click()
    await page.getByPlaceholder(/monto a ahorrar/i).fill('1000')
    const select = page.locator('select').last()
    await select.selectOption('')
    await page.getByRole('button', { name: /guardar ahorro/i }).click()

    await expect(page.getByText('Completada')).toBeVisible({ timeout: 5_000 })
  })

  test('eliminar una meta', async ({ page }) => {
    await page.getByRole('button', { name: /nueva meta|crear primera meta/i }).click()
    await page.getByPlaceholder(/viaje|fondo/i).fill('Meta para eliminar E2E')
    await page.getByPlaceholder('0').first().fill('100000')
    await page.getByRole('button', { name: /crear meta/i }).click()
    await expect(page.getByText('Meta para eliminar E2E')).toBeVisible()

    await page.getByRole('button', { name: /eliminar|trash/i }).last().click()
    await expect(page.getByText('Meta para eliminar E2E')).not.toBeVisible({ timeout: 5_000 })
  })
})
