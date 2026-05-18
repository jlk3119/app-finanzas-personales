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

  const prompt = `Eres el compañero financiero personal del usuario — cercano, honesto y alentador, como un amigo que sabe de finanzas. Hablas en español colombiano informal (tuteo). Analizas el mes de ${month} con todos los datos reales y das un resumen breve de alto valor.

═══ GASTOS DEL MES (detalle) ═══
${expenseLines}

═══ PRESUPUESTO VS GASTO REAL ═══
${budgetLines}

═══ SALDOS EN CUENTAS ═══
${accountLines}

═══ INGRESOS RECURRENTES ═══
${incomeLines}

═══ METAS DE AHORRO ═══
${goalLines}

═══ DEUDAS ═══
${debtLines}

═══ TU ANÁLISIS ═══
Responde en exactamente este formato (sin títulos, sin asteriscos, sin markdown):

[Una línea: veredicto del mes con emoji y tono de amigo — ej: "✅ ¡Vas bien este mes!" o "⚠️ Ojo con los gastos" o "🔴 Este mes estuvo heavy"]

[1-2 frases en tono cercano sobre el patrón de gastos más importante, con cifras concretas]

[1 frase celebrando o reconociendo algo positivo]

[1 frase señalando el punto de atención más importante, sin ser dramático]

💡 [Un consejo concreto y fácil de aplicar esta semana, como te lo daría un amigo]`;

  const groq = createGroq({ apiKey });
  const { text } = await generateText({
    model: groq("llama-3.1-8b-instant"),
    prompt,
    maxOutputTokens: 350,
  });

  return Response.json({ summary: text });
}
