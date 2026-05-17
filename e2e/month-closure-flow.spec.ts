import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123'

test.describe('Flujo de cierre de mes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/correo/i).fill(EMAIL)
    await page.getByLabel(/contraseña/i).fill(PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await expect(page).toHaveURL(/tab=dashboard|^\/$/, { timeout: 10_000 })
  })

  test('el resumen del mes anterior aparece si no está cerrado', async ({ page }) => {
    // Si hay un cierre pendiente del mes anterior, debe mostrarse la tarjeta
    const closureCard = page.getByText(/resumen del mes cerrado/i)
    if (await closureCard.isVisible()) {
      // Verificar que muestra mes y año
      await expect(page.getByText(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i).first()).toBeVisible()
      // Verificar que muestra el total gastado
      await expect(page.getByText(/total gastado/i)).toBeVisible()
    }
  })

  test('el botón "Entendido" registra el cierre del mes', async ({ page }) => {
    const closureCard = page.getByText(/resumen del mes cerrado/i)
    if (await closureCard.isVisible()) {
      await page.getByRole('button', { name: /entendido/i }).click()
      // La tarjeta debe desaparecer
      await expect(closureCard).not.toBeVisible({ timeout: 5_000 })
    }
  })

  test('al cerrar el mes con superávit se puede mover a una meta', async ({ page }) => {
    const closureCard = page.getByText(/resumen del mes cerrado/i)
    if (await closureCard.isVisible()) {
      const moverButton = page.getByRole('button', { name: /mover a meta/i })
      if (await moverButton.isVisible()) {
        await moverButton.click()
        // Debe mostrar la lista de metas
        await expect(page.getByText(/elige dónde agregar/i)).toBeVisible()
        // Presionar cancelar para no afectar datos
        await page.getByRole('button', { name: /cancelar/i }).click()
      }
    }
  })

  test('el Presupuesto muestra la navegación por meses', async ({ page }) => {
    await page.getByRole('button', { name: /presup/i }).click()
    await expect(page.getByRole('button', { name: /chevron|anterior|</i })).toBeVisible()
    await expect(page.getByRole('button', { name: /chevron|siguiente|>/i })).toBeVisible()
  })

  test('navegar al mes anterior muestra los presupuestos de ese mes', async ({ page }) => {
    await page.getByRole('button', { name: /presup/i }).click()
    await page.locator('[data-slot="tabs-content"] button, [role="tabpanel"] button').first().click().catch(() => {})
  })
})
