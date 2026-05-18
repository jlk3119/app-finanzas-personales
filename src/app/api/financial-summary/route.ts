import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 });
  }

  const {
    month,
    expenses,
    budgets,
    accounts,
    goals,
    debts,
    recurringIncome,
  } = await req.json();

  // Build expense lines
  const expenseLines = expenses.length > 0
    ? expenses
        .map((e: { date: string; category: string; subcategory?: string; amount: number; description: string; account?: string }) =>
          `${e.date} | ${e.category}${e.subcategory ? ` > ${e.subcategory}` : ""} | $${e.amount.toLocaleString("es-CO")} | ${e.description}${e.account ? ` [${e.account}]` : ""}`
        )
        .join("\n")
    : "Sin gastos registrados este mes";

  // Build budget lines
  const budgetLines = budgets.length > 0
    ? budgets
        .map((b: { category: string; amount: number; spent: number }) =>
          `${b.category}: presupuesto $${b.amount.toLocaleString("es-CO")}, gastado $${b.spent.toLocaleString("es-CO")} (${Math.round((b.spent / b.amount) * 100)}%)`
        )
        .join("\n")
    : "Sin presupuesto definido";

  // Build account lines
  const accountLines = accounts
    .map((a: { name: string; balance: number }) => `${a.name}: $${a.balance.toLocaleString("es-CO")}`)
    .join("\n");

  // Build goal lines
  const goalLines = goals.length > 0
    ? goals
        .map((g: { name: string; target: number; current: number; deadline?: string }) => {
          const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
          return `${g.name}: $${g.current.toLocaleString("es-CO")} de $${g.target.toLocaleString("es-CO")} (${pct}%)${g.deadline ? `, fecha límite ${g.deadline}` : ""}`;
        })
        .join("\n")
    : "Sin metas activas";

  // Build debt lines
  const debtLines = debts.length > 0
    ? debts
        .map((d: { name: string; entity: string; total: number; paid: number }) => {
          const remaining = d.total - d.paid;
          const pct = d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0;
          return `${d.name} (${d.entity}): total $${d.total.toLocaleString("es-CO")}, pagado $${d.paid.toLocaleString("es-CO")}, pendiente $${remaining.toLocaleString("es-CO")} (${pct}% pagado)`;
        })
        .join("\n")
    : "Sin deudas registradas";

  // Build income lines
  const incomeLines = recurringIncome.length > 0
    ? recurringIncome
        .map((r: { name: string; amount: number; frequency: string }) =>
          `${r.name}: $${r.amount.toLocaleString("es-CO")} (${r.frequency})`
        )
        .join("\n")
    : "Sin ingresos recurrentes configurados";

  const prompt = `Eres el compañero financiero personal del usuario — cercano, honesto y alentador, como un amigo que sabe de finanzas. Hablas en español colombiano informal (tuteo). Analizas ${month} con los datos reales.

CONTEXTO IMPORTANTE: Todos los montos están en pesos colombianos (COP). En Colombia, $23.000 COP es muy poco (equivale a ~$5 USD). Un gasto "alto" en Colombia parte desde $200.000 COP en adelante para gastos cotidianos, y desde $1.000.000 COP para gastos significativos. Calibra tus comentarios con esta escala real.

═══ GASTOS DEL MES ═══
${expenseLines}

═══ PRESUPUESTO VS REAL ═══
${budgetLines}

═══ CUENTAS ═══
${accountLines}

═══ INGRESOS RECURRENTES ═══
${incomeLines}

═══ METAS ═══
${goalLines}

═══ DEUDAS ═══
${debtLines}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código:
{"status":"good|warning|critical","verdict":"máx 6 palabras, tono amigo, sin emoji","insight":"1 frase con la observación más importante del mes, cifras concretas en COP","action":"1 consejo específico y fácil de aplicar esta semana"}

Elige status: "good" si todo va bien, "warning" si hay algo que cuidar, "critical" si hay un problema real.`;

  const groq = createGroq({ apiKey });
  const { text } = await generateText({
    model: groq("llama-3.1-8b-instant"),
    prompt,
    maxOutputTokens: 200,
  });

  // Extract JSON robustly — strip any surrounding prose the model may add
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json({ error: "Respuesta inesperada del modelo" }, { status: 500 });
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    status: "good" | "warning" | "critical";
    verdict: string;
    insight: string;
    action: string;
  };

  return Response.json(parsed);
}
