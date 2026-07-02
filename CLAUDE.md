# CLAUDE.md — MisFinanzas

App web PWA de finanzas personales, optimizada para móvil, desplegada en Vercel:
`appfinanzaspersonales.vercel.app`

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Base de datos / Auth | Supabase (PostgreSQL + Row Level Security) |
| UI | shadcn/ui + Tailwind CSS v4 (tema M3 Expressive, seed esmeralda hue 178 / oro hue 82) |
| Tipografía | Geist (cuerpo) + Bricolage Grotesque (display, montos) |
| Iconos | Lucide React |
| Lenguaje | TypeScript estricto |

---

## Comandos esenciales

```bash
npm run dev          # desarrollo local
npm run build        # build de producción (DEBE pasar sin errores antes de entregar)
npm run lint         # ESLint
npm run test         # Jest + Testing Library
npm run test:e2e     # Playwright
npm run type-check   # tsc --noEmit
```

---

## Estructura de archivos

```
src/
  app/
    page.tsx              ← estado global + fetchData() + tabs
    layout.tsx
    login/page.tsx
    auth/callback/route.ts
  components/
    ExpenseForm.tsx        ← formulario nuevo gasto (Sheet)
    ExpenseList.tsx        ← lista gastos con edición/eliminación
    BudgetManager.tsx      ← presupuestos mensuales y semanales
    GoalsList.tsx          ← metas de ahorro
    AccountsManager.tsx    ← cuentas + ingresos recurrentes
    CategoryManager.tsx    ← CRUD categorías y subcategorías
    MonthClosureCard.tsx   ← cierre de mes
  types/index.ts
  utils/supabase/          ← client, server, middleware
  hooks/useBackButtonClose.ts
```

---

## Esquema de base de datos

```sql
-- RLS activo en todas las tablas; nunca filtrar manualmente por user_id en el cliente.

categories (id, user_id, name, icon, color, is_system, parent_id → categories(id))
expenses   (id, user_id, category_id → categories ON DELETE SET NULL, amount, description, date)
budgets    (id, user_id, category_id → categories ON DELETE CASCADE, period, amount, year, month, week)
           -- category_id = NULL → presupuesto global
           -- UNIQUE(user_id, category_id, period, year, month, week)
goals      (id, user_id, name, target_amount, current_amount, deadline, icon, completed, category_id)
accounts   (id, user_id, name, balance, icon, color)
recurring_income (id, user_id, account_id, name, amount, frequency, day_of_month, is_salary, auto_assign, start_date)
income     (id, user_id, account_id, amount, description, date, recurring_income_id, period_key)
month_closures (id, user_id, year, month, closed_at) -- UNIQUE(user_id, year, month)
```

---

## Tipos TypeScript

```typescript
type Category       = { id, user_id, name, icon, color, is_system, parent_id, created_at }
type Expense        = { id, user_id, category_id, amount, description, date, categories? }
type Budget         = { id, user_id, category_id, period, amount, year, month, week, categories? }
type Goal           = { id, user_id, name, target_amount, current_amount, deadline, icon, completed, category_id, categories? }
type Account        = { id, user_id, name, balance, icon, color }
type RecurringIncome= { id, user_id, account_id, name, amount, frequency, day_of_month, is_salary, auto_assign, start_date }
type Income         = { id, user_id, account_id, amount, description, date, recurring_income_id, period_key }
type MonthClosure   = { id, user_id, year, month, closed_at }
```

---

## Navegación (5 tabs — barra inferior)

| Tab | Componente |
|---|---|
| Resumen | `page.tsx` — gastos Hoy/Semana/Mes, gráfica por categoría, últimos gastos |
| Gastos | `ExpenseList` — lista completa, editar/eliminar |
| Presup. | `BudgetManager` — presupuestos mensuales/semanales |
| Metas | `GoalsList` — metas con progreso |
| Dinero | `AccountsManager` — cuentas + ingresos recurrentes + historial |

---

## Comportamientos críticos (no cambiar sin instrucción explícita)

- **Fechas**: usar siempre hora local — `getFullYear()`, `getMonth()`, `getDate()`. Nunca `toISOString()` para comparaciones de fecha.
- **Categorías**: jerarquía de un nivel. `parent_id = null` → categoría raíz. Máximo un nivel de profundidad.
- **Presupuestos**: `category_id = null` → presupuesto global. Sub-presupuestos se asignan a subcategorías desde el formulario del padre.
- **Metas de ahorro**: al agregar ahorro con categoría fuente, crear automáticamente un gasto en esa categoría para reflejarlo en el presupuesto.
- **Cierre de mes**: registra en `month_closures`, muestra resumen con totales, excesos y transferencia a metas.
- **Ingresos recurrentes**: `monthly` (×1/mes), `biweekly` (×2/mes), `weekly` (×4/mes). `auto_assign` = asignar automáticamente al presupuesto.
- **Formato de moneda**: COP — `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
- **RLS**: no filtrar por `user_id` en el cliente; Supabase lo maneja.

---

## Convenciones de código

- Todo el estado global en `src/app/page.tsx` con un único `fetchData()` que recarga todo desde Supabase.
- Los componentes hijos reciben datos como props y llaman `onRefresh()` después de mutar.
- Todo es `"use client"` — no usar Server Components en componentes de UI.
- `useBackButtonClose(condition, closeCallback)` para cerrar modales/formularios con el botón atrás del móvil.
- Formularios en línea dentro de las cards (no dialogs separados), excepto `ExpenseForm` que usa un Sheet.
- Sin comentarios salvo cuando el motivo no es obvio.
- TypeScript estricto: no usar `any`, tipar todas las funciones y props.

---

## Definition of Done — una feature está completa cuando:

1. La funcionalidad principal opera correctamente en todos los escenarios descritos.
2. Los casos borde y errores están manejados con feedback visible al usuario (toast, mensaje inline, etc.).
3. El build de producción pasa sin errores: `npm run build`.
4. El type-check pasa limpio: `npm run type-check`.
5. El linter pasa sin errores: `npm run lint`.
6. Existen pruebas para la feature nueva (ver sección Testing).
7. Toda la suite de pruebas pasa: `npm run test`.
8. La UI es completamente funcional en viewport móvil (375px mínimo).
9. Las operaciones de Supabase manejan el caso de error con `try/catch` o `.catch()`.

**No marques ninguna feature como terminada si alguno de estos puntos falla.**

---

## Testing — instrucciones obligatorias

### Cuándo escribir pruebas
Escribe pruebas antes o inmediatamente después de implementar cada feature. Nunca al final del proyecto.

### Estructura de archivos de prueba
```
src/
  components/
    ExpenseForm.tsx
    __tests__/
      ExpenseForm.test.tsx     ← pruebas unitarias / integración
  utils/
    __tests__/
      currency.test.ts
      dates.test.ts
e2e/
  expense-flow.spec.ts         ← flujos E2E con Playwright
  budget-flow.spec.ts
```

### Pruebas unitarias (Jest + React Testing Library)

Para cada componente o utilidad nueva, cubrir:

```typescript
// Ejemplo de lo que se debe probar en un componente
describe('ExpenseForm', () => {
  it('renderiza el formulario con los campos requeridos')
  it('deshabilita el botón submit si amount está vacío')
  it('llama onRefresh() después de guardar exitosamente')
  it('muestra mensaje de error si Supabase retorna error')
  it('formatea el monto en COP al perder el foco del input')
  it('cierra el Sheet al presionar el botón atrás del móvil')
})
```

Reglas:
- Mockear Supabase con `jest.mock('@/utils/supabase/client')`.
- Probar comportamiento observable (texto en pantalla, llamadas a callbacks), no detalles internos de implementación.
- Cada test debe poder fallar por un defecto real — si no puede fallar, eliminarlo.
- Nombrar los tests con lenguaje del dominio: "registra un gasto", "muestra el presupuesto excedido", no "llama a setState".

### Pruebas E2E (Playwright)

Cubrir los flujos críticos del usuario:

```typescript
// Flujos mínimos requeridos
- Registro e inicio de sesión
- Crear, editar y eliminar un gasto
- Asignar un presupuesto mensual y verificar que se actualiza al agregar gastos
- Agregar un ahorro a una meta con categoría fuente y verificar que aparece en gastos
- Cierre de mes: verificar resumen y que el mes queda bloqueado
- Navegar entre los 5 tabs sin errores
```

### Pruebas de accesibilidad
- Verificar que todos los formularios son operables con teclado.
- Usar `getByRole`, `getByLabelText` en lugar de `getByTestId` cuando sea posible.

### Cobertura mínima aceptable
- Lógica de negocio (utils, cálculos de presupuesto, fechas): 90%
- Componentes UI con lógica propia: 70%
- Flujos E2E críticos: 100% de los listados arriba

### Después de cada cambio
Ejecutar en este orden y corregir antes de continuar:
```bash
npm run type-check
npm run lint
npm run test
npm run build
```

---

## Gestión de errores

- Toda operación async contra Supabase debe tener `try/catch` con manejo explícito del error.
- Mostrar feedback al usuario: usar `useSnackbar()` (`src/components/SnackbarProvider.tsx`) para operaciones CRUD, mensajes inline para errores de validación.
- Los saldos de cuentas se actualizan SOLO con la RPC atómica `increment_balance(p_account_id, p_delta, p_clamp_zero)` — nunca con `update({ balance })` calculado en el cliente (salvo asignación absoluta al crear/editar la cuenta).
- Nunca silenciar errores con `catch(() => {})` vacío.
- Loguear errores con `console.error` en desarrollo; no exponer mensajes técnicos al usuario.

---

## UX móvil (reglas no negociables)

- Viewport mínimo soportado: 375px de ancho.
- Todos los elementos interactivos deben tener un área táctil mínima de 44×44px.
- Los Sheets y modales deben cerrarse con el botón atrás del dispositivo (`useBackButtonClose`).
- No usar hover como único indicador de estado — el dispositivo táctil no tiene hover.
- Los inputs numéricos deben abrir teclado numérico en móvil: `inputMode="decimal"`.

---

## Seguridad

- Nunca exponer claves de Supabase en código del cliente (solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Confiar en RLS de Supabase para el filtrado por usuario; no construir filtros manuales de `user_id` en el cliente.
- Validar y sanitizar todos los inputs antes de enviar a Supabase.
- No hacer `console.log` de datos del usuario en producción.

---

## Lo que NO hacer

- No crear Server Components para UI interactiva — todo es `"use client"`.
- No duplicar `fetchData()` — los componentes hijos llaman `onRefresh()` para recargar.
- No usar `toISOString()` para comparaciones de fechas locales.
- No agregar comentarios obvios que repitan lo que hace el código.
- No usar `any` en TypeScript.
- No declarar una feature como terminada si `npm run build` falla.
- No mezclar niveles de jerarquía de categorías — máximo un nivel de profundidad.
