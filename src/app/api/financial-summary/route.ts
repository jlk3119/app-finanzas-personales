import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 });
  }

  const body = await req.json();
  const {
    monthName,
    totalSpent,
    totalBudget,
    topCategories,
    budgetItems,
    goals,
    debts,
    disponible,
  } = body;

  const categoryLines = topCategories
    .map((c: { name: string; spent: number; budget: number | null }) => {
      const pct = c.budget ? Math.round((c.spent / c.budget) * 100) : null;
      return `  - ${c.name}: gastado $${c.spent.toLocaleString("es-CO")}${c.budget ? ` de $${c.budget.toLocaleString("es-CO")} presupuestado (${pct}%)` : " (sin presupuesto)"}`;
    })
    .join("\n");

  const goalLines =
    goals.length > 0
      ? goals
          .map((g: { name: string; pct: number }) => `  - ${g.name}: ${g.pct}% completado`)
          .join("\n")
      : "  Sin metas registradas";

  const debtLines =
    debts.length > 0
      ? debts
          .map((d: { name: string; entity: string; pct: number; remaining: number }) =>
            `  - ${d.name} (${d.entity}): ${d.pct}% pagado, pendiente $${d.remaining.toLocaleString("es-CO")}`
          )
          .join("\n")
      : "  Sin deudas registradas";

  const budgetSummary =
    totalBudget > 0
      ? `Presupuesto total del mes: $${totalBudget.toLocaleString("es-CO")}. Gastado: $${totalSpent.toLocaleString("es-CO")} (${Math.round((totalSpent / totalBudget) * 100)}% del presupuesto).`
      : `Gasto total del mes: $${totalSpent.toLocaleString("es-CO")}. Sin presupuesto mensual definido.`;

  const prompt = `Eres un asesor financiero personal amigable y directo. Analiza el estado financiero del usuario para ${monthName} y da una evaluación breve y útil en español.

DATOS FINANCIEROS:
${budgetSummary}
Saldo disponible en cuentas: $${disponible.toLocaleString("es-CO")}

Gastos por categoría este mes:
${categoryLines || "  Sin gastos registrados"}

Metas de ahorro:
${goalLines}

Deudas:
${debtLines}

INSTRUCCIONES:
- Sé directo y concreto, máximo 4 párrafos cortos.
- Empieza con una evaluación general (buena, regular, atención requerida).
- Señala 1-2 puntos positivos.
- Señala 1-2 áreas de mejora concretas basadas en los datos.
- Termina con un consejo accionable para los próximos días.
- Usa COP (pesos colombianos) y formato colombiano.
- No inventes datos que no están en el resumen.
- Tono cercano, no técnico ni condescendiente.`;

  const groq = createGroq({ apiKey });
  const { text } = await generateText({
    model: groq("llama-3.1-8b-instant"),
    prompt,
    maxOutputTokens: 500,
  });

  return Response.json({ summary: text });
}
