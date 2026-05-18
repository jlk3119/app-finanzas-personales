# Contexto del proyecto: MisFinanzas

**App web PWA de finanzas personales**, pensada para móvil (se usa desde el navegador del celular). Desplegada en Vercel: `appfinanzaspersonales.vercel.app`.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Base de datos / Auth | Supabase (PostgreSQL + Row Level Security) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Gráficas | Recharts |
| Iconos | Lucide React |
| Lenguaje | TypeScript |

---

## Estructura de archivos relevante

```
src/
  app/
    page.tsx              ← componente raíz, maneja estado global y tabs
    layout.tsx
    login/page.tsx
    auth/callback/route.ts
  components/
    ExpenseForm.tsx       ← formulario de nuevo gasto (sheet/modal)
    ExpenseList.tsx       ← lista de gastos con edición/eliminación
    BudgetManager.tsx     ← presupuestos mensuales y semanales
    GoalsList.tsx         ← metas de ahorro
    AccountsManager.tsx   ← cuentas bancarias e ingresos recurrentes
    CategoryManager.tsx   ← CRUD de categorías y subcategorías
    MonthClosureCard.tsx  ← cierre de mes con resumen
  types/index.ts          ← todos los tipos TypeScript
  utils/supabase/         ← client, server, middleware
  hooks/useBackButtonClose.ts
```

---

## Esquema de base de datos (PostgreSQL / Supabase)

```sql
-- Todos los datos filtrados por user_id (RLS activo en todas las tablas)

categories (
  id uuid PK,
  user_id uuid,
  name text,
  icon text,
  color text,
  is_system boolean DEFAULT false,
  parent_id uuid → categories(id)   -- subcategorías (un nivel de profundidad)
)

expenses (
  id uuid PK,
  user_id uuid,
  category_id uuid → categories(id) ON DELETE SET NULL,
  account_id uuid → accounts(id) ON DELETE SET NULL,
  amount numeric(12,2),
  description text,
  date date
)

budgets (
  id uuid PK,
  user_id uuid,
  category_id uuid → categories(id) ON DELETE CASCADE,  -- NULL = total general
  period text CHECK ('monthly' | 'weekly'),
  amount numeric(12,2),
  year int,
  month int,   -- solo si period='monthly'
  week int,    -- solo si period='weekly'
  UNIQUE (user_id, category_id, period, year, month, week)
)

goals (
  id uuid PK,
  user_id uuid,
  name text,
  target_amount numeric(12,2),
  current_amount numeric(12,2) DEFAULT 0,
  deadline date,
  icon text,
  completed boolean DEFAULT false,
  category_id uuid → categories(id) ON DELETE SET NULL  -- categoría fuente por defecto
)

accounts (
  id uuid PK,
  user_id uuid,
  name text,
  balance numeric,
  icon text,
  color text
)

recurring_income (
  id uuid PK,
  user_id uuid,
  account_id uuid → accounts(id),
  name text,
  amount numeric,
  frequency text CHECK ('monthly' | 'biweekly' | 'weekly'),
  day_of_month int,
  is_salary boolean,
  auto_assign boolean,
  start_date date
)

income (
  id uuid PK,
  user_id uuid,
  account_id uuid → accounts(id),
  amount numeric,
  description text,
  date date,
  recurring_income_id uuid,
  period_key text
)

month_closures (
  id uuid PK,
  user_id uuid,
  year int,
  month int,
  closed_at timestamptz,
  UNIQUE (user_id, year, month)
)

debts (
  id uuid PK,
  user_id uuid,
  name text,
  entity text,
  total_amount numeric(14,2),
  paid_amount numeric(14,2) DEFAULT 0,
  icon text DEFAULT '💳',
  color text DEFAULT '#ef4444',
  notes text,
  created_at timestamptz
)
```

---

## Tipos TypeScript principales

```typescript
type Category = { id, user_id, name, icon, color, is_system, parent_id, created_at }
type Expense  = { id, user_id, category_id, account_id?, amount, description, date, categories?, accounts? }
type Budget   = { id, user_id, category_id, period, amount, year, month, week, categories? }
type Goal     = { id, user_id, name, target_amount, current_amount, deadline, icon, completed, category_id, categories? }
type Account  = { id, user_id, name, balance, icon, color }
type RecurringIncome = { id, user_id, account_id, name, amount, frequency, day_of_month, is_salary, auto_assign, start_date }
type Income   = { id, user_id, account_id, amount, description, date, recurring_income_id, period_key }
type MonthClosure = { id, user_id, year, month, closed_at }
type Debt         = { id, user_id, name, entity, total_amount, paid_amount, icon, color, notes }
```

---

## Navegación (5 tabs en barra inferior)

| Tab | Componente principal |
|---|---|
| **Resumen** (dashboard) | `page.tsx` — gastos Hoy/Semana/Mes, gráfica por categoría, últimos gastos |
| **Gastos** | `ExpenseList` — lista completa, editar/eliminar |
| **Presup.** | `BudgetManager` — presupuestos mensuales/semanales, navegar meses |
| **Metas** | `GoalsList` — metas de ahorro con progreso |
| **Dinero** | `AccountsManager` — cuentas, ingresos recurrentes, historial |

---

## Comportamientos clave

- **Comparación de fechas**: siempre usa hora local (no `toISOString()`), con `getFullYear()/getMonth()/getDate()`.
- **Categorías**: tienen jerarquía de un nivel (padre → hijos). `parent_id = null` = categoría raíz.
- **Presupuestos**: `category_id = null` significa presupuesto global. Se pueden asignar sub-presupuestos a las subcategorías desde el mismo formulario del padre.
- **Metas de ahorro**: al agregar un ahorro, se puede elegir una categoría fuente; si se elige, se crea automáticamente un gasto en esa categoría para reflejarlo en el presupuesto.
- **Cierre de mes**: registra el mes como cerrado (`month_closures`) y muestra un resumen con totales, excesos y transferencia a metas.
- **Ingresos recurrentes**: `frequency` puede ser `monthly`, `biweekly` (quincenal ×2) o `weekly` (semanal ×4). `auto_assign` indica si se asigna automáticamente al presupuesto.
- **Formato de moneda**: COP colombiano — `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
- **RLS**: todas las tablas tienen Row Level Security activada; el backend nunca necesita filtrar manualmente por `user_id`.

---

## Convenciones de código

- Todo el estado global vive en `src/app/page.tsx` con un único `fetchData()` que recarga todo desde Supabase.
- Los componentes hijos reciben datos como props y llaman `onRefresh()` después de mutar.
- No hay estado de servidor (Server Components) en los componentes de UI; todo es `"use client"`.
- `useBackButtonClose(condition, closeCallback)` maneja el botón atrás del móvil para cerrar modales/formularios.
- Formularios en línea dentro de las cards (no dialogs separados), excepto `ExpenseForm` que usa un Sheet.
- No se usan comentarios salvo cuando el motivo no es obvio.
