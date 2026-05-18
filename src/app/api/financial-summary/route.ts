import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";

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
type BudgetRow  = { category: string; amount: number; spent: number };
type GoalRow    = { name: string; target: number; current: number; completed: boolean; deadline?: string };
type DebtRow    = { name: string; entity: string; total: number; paid: number };

const SummarySchema = z.object({
  status:  z.enum(["good", "warning", "critical"]),
  verdict: z.string().describe("Máx 6 palabras. Tono de amigo. Sin emojis."),
  insight: z.string().describe("1 frase con la observación más importante basada en el historial real, con cifras COP."),
  action:  z.string().describe("1 consejo concreto y fácil de aplicar esta semana, basado en datos reales."),
});

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 });
  }

  const {
    currentMonth,
    today,
    expensesByMonth,
    budgetsByMonth,
    accounts,
    recurringIncome,
    goals,
    debts,
  } = await req.json() as {
    currentMonth: string;
    today: string;
    expensesByMonth: MonthBlock[];
    budgetsByMonth: Record<string, BudgetRow[]>;
    accounts: { name: string; balance: number }[];
    recurringIncome: { name: string; amount: number; frequency: string }[];
    goals: GoalRow[];
    debts: DebtRow[];
  };

  const expenseSection = expensesByMonth.length > 0
    ? expensesByMonth.map((month) => {
        const rows = month.rows
          .map((e) =>
            `  ${e.date} | ${e.category}${e.subcategory ? ` > ${e.subcategory}` : ""} | $${e.amount.toLocaleString("es-CO")} | ${e.description}${e.account ? ` [${e.account}]` : ""}`
          )
          .join("\n");
        return `[${month.label}] — Total gastado: $${month.total.toLocaleString("es-CO")}\n${rows || "  (sin gastos registrados en este mes)"}`;
      }).join("\n\n")
    : "Sin gastos registrados aún (la app puede ser nueva)";

  const budgetSection = Object.keys(budgetsByMonth).length > 0
    ? Object.entries(budgetsByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, rows]) => {
          const [y, m] = key.split("-").map(Number);
          const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
          const isFuture = (y > parseInt(today.slice(0,4))) || (y === parseInt(today.slice(0,4)) && m > parseInt(today.slice(5,7)));
          const label = `${MONTHS[m - 1]} ${y}${isFuture ? " (MES FUTURO — presupuesto ya definido)" : ""}`;
          const lines = rows
            .map((b) => {
              const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
              return `  ${b.category}: presupuesto $${b.amount.toLocaleString("es-CO")}, gastado $${b.spent.toLocaleString("es-CO")} (${pct}%)`;
            })
            .join("\n");
          return `[${label}]\n${lines}`;
        }).join("\n\n")
    : "Sin presupuestos definidos";

  const accountLines = accounts.length > 0
    ? accounts.map((a) => `  ${a.name}: $${a.balance.toLocaleString("es-CO")}`).join("\n")
    : "  Sin cuentas registradas";

  const incomeLines = recurringIncome.length > 0
    ? recurringIncome.map((r) => `  ${r.name}: $${r.amount.toLocaleString("es-CO")} (${r.frequency})`).join("\n")
    : "  Sin ingresos recurrentes";

  const goalLines = goals.length > 0
    ? goals.map((g) => {
        const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
        const status = g.completed ? "COMPLETADA" : `${pct}% — faltan $${(g.target - g.current).toLocaleString("es-CO")}`;
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

  const prompt = `Eres el compañero financiero personal del usuario, cercano y honesto como un amigo que sabe de finanzas. Tuteo, español colombiano.

FECHA DE HOY: ${today}
MES ACTUAL: ${currentMonth}

═══ CONTEXTO DE MONEDA (COP — MUY IMPORTANTE) ═══
- Toda cifra está en pesos colombianos (COP). $1 USD ≈ $4.300 COP.
- $17.000 COP = menos de $4 USD → INSIGNIFICANTE, nunca lo menciones como problema.
- $50.000 COP = ~$12 USD → bajo.
- $200.000 COP = ~$47 USD → moderado para gasto cotidiano.
- $1.000.000 COP = ~$233 USD → significativo.
- $5.000.000 COP = ~$1.160 USD → alto.
- Nunca llames "notable", "alto" o "considerable" a montos menores de $100.000 COP.

═══ REGLAS PARA EL CAMPO "status" ═══
Elige según la situación REAL del usuario:
- "good": el gasto total del mes es menor al 60% del ingreso mensual Y no hay presupuesto excedido en más del 20%.
- "warning": el gasto supera el 60% del ingreso, O hay algún presupuesto excedido entre 1-30%.
- "critical": el gasto supera el 90% del ingreso, O hay presupuesto excedido en más del 30%, O hay deudas vencidas graves.
- Si el mes está en curso (hoy no es fin de mes), ajusta el análisis al % del mes transcurrido.
- Si hay pocos gastos porque la app es nueva o el mes acaba de empezar → status "good" por defecto.

═══ REGLAS GENERALES ═══
- Los presupuestos marcados "MES FUTURO" son planificación real — es positivo tenerlos.
- Bajo % de ejecución en mes en curso NO significa falta de presupuesto, el mes sigue.
- Usa el historial completo para detectar tendencias reales.
- Menciona cifras COP reales en insight, no porcentajes sin contexto.

═══ GASTOS POR MES ═══
${expenseSection}

═══ PRESUPUESTO VS GASTO REAL ═══
${budgetSection}

═══ SALDOS EN CUENTAS ═══
${accountLines}

═══ INGRESOS RECURRENTES ═══
${incomeLines}

═══ METAS DE AHORRO ═══
${goalLines}

═══ DEUDAS ═══
${debtLines}

═══ INSTRUCCIÓN DE RESPUESTA ═══
Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después. Sin bloques de código. Sin markdown.
Estructura exacta (sin espacios extra en las claves):
{"status":"good","verdict":"frase corta máx 6 palabras sin emojis","insight":"1 frase con la observación más útil y cifras COP reales","action":"1 consejo concreto y fácil de aplicar esta semana"}`;

  const groq = createGroq({ apiKey });

  try {
    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("El modelo no devolvió JSON");
    const parsed = JSON.parse(match[0]);
    const validated = SummarySchema.parse(parsed);
    return Response.json(validated);
  } catch (err) {
    console.error("[financial-summary] error:", err);
    const message = err instanceof Error ? err.message : "Error al generar el resumen";
    return Response.json({ error: message }, { status: 500 });
  }
}
