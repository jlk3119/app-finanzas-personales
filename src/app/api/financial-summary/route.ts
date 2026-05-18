import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

export const runtime = "nodejs";

type ExpenseRow = {
  date: string;
  category: string;
  subcategory?: string;
  amount: number;
  description: string;
  account?: string;
};
type MonthBlock = { label: string; total: number; rows: ExpenseRow[] };
type BudgetRow = { category: string; amount: number; spent: number };
type GoalRow = { name: string; target: number; current: number; completed: boolean; deadline?: string };
type DebtRow = { name: string; entity: string; total: number; paid: number };

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 });
  }

  const {
    currentMonth,
    expensesByMonth,
    budgetsByMonth,
    accounts,
    recurringIncome,
    goals,
    debts,
  } = await req.json() as {
    currentMonth: string;
    expensesByMonth: MonthBlock[];
    budgetsByMonth: Record<string, BudgetRow[]>;
    accounts: { name: string; balance: number }[];
    recurringIncome: { name: string; amount: number; frequency: string }[];
    goals: GoalRow[];
    debts: DebtRow[];
  };

  // Build historical expense section
  const expenseSection = expensesByMonth.length > 0
    ? expensesByMonth.map((month) => {
        const rows = month.rows
          .map((e) =>
            `  ${e.date} | ${e.category}${e.subcategory ? ` > ${e.subcategory}` : ""} | $${e.amount.toLocaleString("es-CO")} | ${e.description}${e.account ? ` [${e.account}]` : ""}`
          )
          .join("\n");
        return `[${month.label}] — Total: $${month.total.toLocaleString("es-CO")}\n${rows}`;
      }).join("\n\n")
    : "Sin gastos registrados";

  // Build budget vs real section
  const budgetSection = Object.keys(budgetsByMonth).length > 0
    ? Object.entries(budgetsByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, rows]) => {
          const [y, m] = key.split("-").map(Number);
          const label = `${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m - 1]} ${y}`;
          const lines = rows
            .map((b) => `  ${b.category}: presupuesto $${b.amount.toLocaleString("es-CO")}, gastado $${b.spent.toLocaleString("es-CO")} (${Math.round((b.spent / b.amount) * 100)}%)`)
            .join("\n");
          return `[${label}]\n${lines}`;
        }).join("\n\n")
    : "Sin presupuestos definidos";

  const accountLines = accounts.map((a) => `  ${a.name}: $${a.balance.toLocaleString("es-CO")}`).join("\n");
  const incomeLines = recurringIncome.length > 0
    ? recurringIncome.map((r) => `  ${r.name}: $${r.amount.toLocaleString("es-CO")} (${r.frequency})`).join("\n")
    : "  Sin ingresos recurrentes";

  const goalLines = goals.length > 0
    ? goals.map((g) => {
        const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
        const status = g.completed ? "✅ Completada" : `${pct}% — faltan $${(g.target - g.current).toLocaleString("es-CO")}`;
        return `  ${g.name}: $${g.current.toLocaleString("es-CO")} de $${g.target.toLocaleString("es-CO")} (${status})${g.deadline ? `, límite ${g.deadline}` : ""}`;
      }).join("\n")
    : "  Sin metas";

  const debtLines = debts.length > 0
    ? debts.map((d) => {
        const remaining = d.total - d.paid;
        const pct = d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0;
        return `  ${d.name} (${d.entity}): total $${d.total.toLocaleString("es-CO")}, pagado $${d.paid.toLocaleString("es-CO")}, pendiente $${remaining.toLocaleString("es-CO")} (${pct}% pagado)`;
      }).join("\n")
    : "  Sin deudas";

  const prompt = `Eres el compañero financiero personal del usuario — cercano, honesto y alentador como un amigo que sabe de finanzas. Hablas en español colombiano informal (tuteo).

CONTEXTO CLAVE:
- Moneda: pesos colombianos (COP). $23.000 COP ≈ $5 USD — es muy poco. Un gasto cotidiano "alto" parte desde $200.000 COP; uno significativo desde $1.000.000 COP.
- Mes actual bajo análisis: ${currentMonth}
- Tienes acceso al historial completo: úsalo para identificar tendencias, comparar meses y detectar patrones.

═══ HISTORIAL DE GASTOS (todos los meses) ═══
${expenseSection}

═══ PRESUPUESTO VS GASTO REAL (por mes) ═══
${budgetSection}

═══ SALDOS ACTUALES EN CUENTAS ═══
${accountLines}

═══ INGRESOS RECURRENTES ═══
${incomeLines}

═══ METAS DE AHORRO ═══
${goalLines}

═══ DEUDAS ═══
${debtLines}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código:
{"status":"good|warning|critical","verdict":"máx 6 palabras, tono de amigo, sin emoji","insight":"1 frase con la observación más importante considerando el historial completo, con cifras COP concretas","action":"1 consejo específico y fácil de aplicar esta semana, basado en patrones reales del historial"}

status: "good" = todo bien, "warning" = algo que cuidar, "critical" = problema real.`;

  const groq = createGroq({ apiKey });
  const { text } = await generateText({
    model: groq("llama-3.1-8b-instant"),
    prompt,
    maxOutputTokens: 200,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json({ error: "Respuesta inesperada del modelo" }, { status: 500 });
  }

  let parsed: { status: string; verdict: string; insight: string; action: string };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return Response.json({ error: "JSON inválido en la respuesta del modelo" }, { status: 500 });
  }

  const rawStatus = String(parsed.status ?? "").toLowerCase();
  const status: "good" | "warning" | "critical" =
    rawStatus === "critical" ? "critical" : rawStatus === "warning" ? "warning" : "good";

  const sanitize = (s: unknown) =>
    String(s ?? "").replace(/[*`_]/g, "").replace(/\n/g, " ").trim();

  return Response.json({
    status,
    verdict: sanitize(parsed.verdict),
    insight: sanitize(parsed.insight),
    action: sanitize(parsed.action),
  });
}
