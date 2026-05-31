import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { friendlyAIError } from "@/utils/ai-error";

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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

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

═══ REGLAS PARA EL CAMPO "status" — EVALÚA EN ORDEN ═══
Aplica la primera regla que sea verdadera:

1. CRITICAL si cualquiera de estas condiciones:
   - Algún presupuesto del mes actual excedido en más del 30%.
   - El mes anterior tuvo presupuesto excedido en más del 50%.
   - Saldo total en cuentas < 10% del ingreso mensual.

2. WARNING si cualquiera de estas condiciones:
   - Gasto actual > 60% del ingreso mensual (proporcionalmente al % del mes transcurrido).
   - Algún presupuesto excedido entre 1-30%.
   - El mes anterior tuvo presupuesto excedido entre 20-50%.
   - Saldo total en cuentas < 30% del ingreso mensual.
   - Hay deudas con más del 80% pendiente Y el saldo en cuentas es bajo.

3. GOOD en todos los demás casos, incluyendo:
   - Pocos gastos porque la app es nueva o el mes acaba de empezar.
   - Bajo % de ejecución del presupuesto porque el mes está en curso.

═══ REGLAS PARA EL CAMPO "insight" ═══
Prioriza en este orden lo que menciones:
1. Si hay presupuesto excedido (mes actual o anterior): mencionarlo con cifras.
2. Si el saldo es bajo vs ingreso: mencionarlo.
3. Si hay deuda significativa (>$2.000.000 COP pendiente): mencionarla.
4. Si todo está bien: resalta el logro más positivo con cifras reales.
Nunca escribas solo porcentajes sin la cifra absoluta en COP.

═══ REGLAS PARA EL CAMPO "verdict" ═══
Máx 6 palabras. Varía el lenguaje según el contexto real — evita frases genéricas como "Gastos bajo control" cuando hay situaciones específicas que nombrar. Sé concreto: "Abril se pasó del presupuesto", "Saldo bajo esta semana", "Excelente ritmo de ahorro".

═══ REGLAS GENERALES ═══
- Los presupuestos marcados "MES FUTURO" son planificación real — es positivo tenerlos.
- Usa el historial completo, no solo el mes actual.
- Menciona cifras COP reales siempre.

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
    const { message, status } = friendlyAIError(err instanceof Error ? err.message : "");
    return Response.json({ error: message }, { status });
  }
}
